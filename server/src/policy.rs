//! Policy engine: configurable rules that validate and gate proposals.
//! Policies are evaluated at create, review, and apply time.

use serde::{Deserialize, Serialize};

use crate::types::proposal::{Proposal, ProposalStatus, Review, ReviewAction};

/// A single policy violation returned when a rule is not satisfied.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyViolation {
    pub rule: String,
    pub message: String,
}

/// Policy rules loaded from configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PolicyRule {
    /// Require a minimum number of approvals before a proposal can be accepted.
    MinApprovals {
        /// Node types this rule applies to (empty = all).
        #[serde(default)]
        node_types: Vec<String>,
        min: u32,
    },
    /// Require at least one reviewer with a specific role.
    RequiredReviewerRole {
        #[serde(default)]
        node_types: Vec<String>,
        role: String,
    },
    /// Restrict apply to certain days/hours (CAB window).
    ChangeWindow {
        /// Allowed days of the week (0=Mon, 6=Sun).
        allowed_days: Vec<u8>,
        /// Allowed hour range (start inclusive, end exclusive, 24h).
        allowed_hour_start: u8,
        allowed_hour_end: u8,
    },
    /// Block agents from specific actions.
    AgentRestriction { blocked_actions: Vec<String> },
    /// Limit proposal size for agents.
    AgentProposalLimit {
        max_operations: u32,
        #[serde(default = "default_max_content_length")]
        max_content_length: u32,
    },
    /// Egress control: limit sensitivity level that agents can read.
    EgressControl {
        /// Maximum sensitivity level agents are allowed to read (inclusive).
        /// Nodes above this level will be redacted for agents.
        max_sensitivity: crate::sensitivity::Sensitivity,
        /// Optional destination restrictions (future use).
        #[serde(default)]
        destinations: Vec<String>,
    },
}

fn default_max_content_length() -> u32 {
    50_000
}

/// Full policy configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PolicyConfig {
    #[serde(default)]
    pub rules: Vec<PolicyRule>,
}

impl PolicyConfig {
    /// Load from a JSON file path, or return empty config if file doesn't exist.
    pub fn load_from_file(path: &std::path::Path) -> Self {
        if path.exists() {
            if let Ok(s) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<PolicyConfig>(&s) {
                    return config;
                }
            }
        }
        Self::default()
    }
}

/// Evaluate policies when creating a proposal.
/// Returns violations (empty = pass).
pub fn evaluate_on_create(
    proposal: &Proposal,
    actor_type: &str,
    policies: &PolicyConfig,
) -> Vec<PolicyViolation> {
    let mut violations = Vec::new();

    for rule in &policies.rules {
        match rule {
            PolicyRule::AgentProposalLimit {
                max_operations,
                max_content_length,
            } if actor_type == "agent" => {
                if proposal.operations.len() as u32 > *max_operations {
                    violations.push(PolicyViolation {
                        rule: "agent_proposal_limit".to_string(),
                        message: format!(
                            "agent proposals limited to {} operations, got {}",
                            max_operations,
                            proposal.operations.len()
                        ),
                    });
                }
                let total_content: u32 = proposal
                    .operations
                    .iter()
                    .map(|op| match op {
                        crate::types::proposal::Operation::Create { node, .. } => {
                            node.content.len() as u32
                        }
                        crate::types::proposal::Operation::Update { changes, .. } => {
                            changes.content.as_ref().map_or(0, |c| c.len() as u32)
                        }
                        _ => 0,
                    })
                    .sum();
                if total_content > *max_content_length {
                    violations.push(PolicyViolation {
                        rule: "agent_proposal_limit".to_string(),
                        message: format!(
                            "agent proposal content limited to {} bytes, got {}",
                            max_content_length, total_content
                        ),
                    });
                }
            }
            _ => {}
        }
    }

    // Check if agent is trying to modify restricted-sensitivity nodes
    violations.extend(check_agent_restricted_node_modification(
        proposal, actor_type, policies,
    ));

    violations
}

/// Evaluate policies when a review is submitted.
/// Returns the new proposal status if all approval rules are met, or None if still pending.
/// Also returns any violations.
pub fn evaluate_on_review(
    proposal: &Proposal,
    all_reviews: &[Review],
    policies: &PolicyConfig,
) -> (Option<ProposalStatus>, Vec<PolicyViolation>) {
    let mut violations = Vec::new();

    // Check if any review rejected
    let has_rejection = all_reviews.iter().any(|r| r.action == ReviewAction::Reject);
    if has_rejection {
        return (Some(ProposalStatus::Rejected), violations);
    }

    let accept_count = all_reviews
        .iter()
        .filter(|r| r.action == ReviewAction::Accept)
        .count() as u32;

    let mut min_approvals_needed: u32 = 1; // default: 1 approval needed

    for rule in &policies.rules {
        match rule {
            PolicyRule::MinApprovals { node_types, min } => {
                if node_types.is_empty() || proposal_touches_node_types(proposal, node_types) {
                    min_approvals_needed = min_approvals_needed.max(*min);
                }
            }
            PolicyRule::RequiredReviewerRole {
                node_types, role, ..
            } => {
                if node_types.is_empty() || proposal_touches_node_types(proposal, node_types) {
                    let has_role_reviewer = all_reviews.iter().any(|r| {
                        r.action == ReviewAction::Accept
                            && r.reviewer_role.as_deref() == Some(role.as_str())
                    });
                    if !has_role_reviewer {
                        violations.push(PolicyViolation {
                            rule: "required_reviewer_role".to_string(),
                            message: format!("requires reviewer with role '{}'", role),
                        });
                    }
                }
            }
            _ => {}
        }
    }

    if accept_count >= min_approvals_needed && violations.is_empty() {
        (Some(ProposalStatus::Accepted), violations)
    } else {
        (None, violations) // still pending more reviews
    }
}

/// Evaluate policies at apply time.
/// Returns violations (empty = allow apply).
pub fn evaluate_on_apply(
    _proposal: &Proposal,
    actor_type: &str,
    policies: &PolicyConfig,
) -> Vec<PolicyViolation> {
    let mut violations = Vec::new();

    for rule in &policies.rules {
        match rule {
            PolicyRule::ChangeWindow {
                allowed_days,
                allowed_hour_start,
                allowed_hour_end,
            } => {
                let now = chrono::Utc::now();
                let weekday = now.format("%u").to_string().parse::<u8>().unwrap_or(1) - 1; // 0=Mon
                let hour = now.format("%H").to_string().parse::<u8>().unwrap_or(0);
                if !allowed_days.contains(&weekday) {
                    violations.push(PolicyViolation {
                        rule: "change_window".to_string(),
                        message: format!(
                            "apply not allowed on day {} (allowed: {:?})",
                            weekday, allowed_days
                        ),
                    });
                }
                if hour < *allowed_hour_start || hour >= *allowed_hour_end {
                    violations.push(PolicyViolation {
                        rule: "change_window".to_string(),
                        message: format!(
                            "apply not allowed at hour {} (allowed: {}–{})",
                            hour, allowed_hour_start, allowed_hour_end
                        ),
                    });
                }
            }
            PolicyRule::AgentRestriction { blocked_actions } if actor_type == "agent" => {
                if blocked_actions.contains(&"apply".to_string()) {
                    violations.push(PolicyViolation {
                        rule: "agent_restriction".to_string(),
                        message: "agents cannot apply proposals".to_string(),
                    });
                }
            }
            _ => {}
        }
    }

    violations
}

/// Get the maximum sensitivity level an agent is allowed to read, based on EgressControl policies.
/// Defaults to `Internal` if no EgressControl rule is configured.
pub fn agent_max_sensitivity(policies: &PolicyConfig) -> crate::sensitivity::Sensitivity {
    for rule in &policies.rules {
        if let PolicyRule::EgressControl {
            max_sensitivity, ..
        } = rule
        {
            return *max_sensitivity;
        }
    }
    // Default: agents can read up to Internal
    crate::sensitivity::Sensitivity::Internal
}

/// Check if a proposal's operations touch any restricted-sensitivity nodes.
/// Returns violations if an agent tries to modify restricted nodes.
pub fn check_agent_restricted_node_modification(
    proposal: &Proposal,
    actor_type: &str,
    policies: &PolicyConfig,
) -> Vec<PolicyViolation> {
    let mut violations = Vec::new();
    if actor_type != "agent" {
        return violations;
    }
    let max_sens = agent_max_sensitivity(policies);
    for op in &proposal.operations {
        match op {
            crate::types::proposal::Operation::Create { node, .. } => {
                if let Some(ref sens) = node.metadata.sensitivity {
                    if *sens > max_sens {
                        violations.push(PolicyViolation {
                            rule: "agent_restricted_modification".to_string(),
                            message: format!(
                                "agents cannot create nodes with sensitivity '{}' (max allowed: '{}')",
                                sens.as_str(),
                                max_sens.as_str()
                            ),
                        });
                    }
                }
            }
            _ => {}
        }
    }
    violations
}

/// Check if a proposal's operations touch any of the given node types.
fn proposal_touches_node_types(proposal: &Proposal, node_types: &[String]) -> bool {
    proposal.operations.iter().any(|op| {
        let nt = match op {
            crate::types::proposal::Operation::Create { node, .. } => {
                node.node_type.as_str().to_string()
            }
            _ => return false,
        };
        node_types.iter().any(|t| t == &nt)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensitivity::Sensitivity;
    use crate::types::proposal::{ProposalMetadata, ProposalStatus};

    fn empty_proposal() -> Proposal {
        Proposal {
            id: "p-test".to_string(),
            status: ProposalStatus::Open,
            operations: vec![],
            metadata: ProposalMetadata {
                created_at: "2026-01-01T00:00:00Z".to_string(),
                created_by: "test".to_string(),
                modified_at: "2026-01-01T00:00:00Z".to_string(),
                modified_by: "test".to_string(),
                rationale: None,
                required_approvers: None,
                approved_by: None,
                base_versions: None,
            },
            comments: None,
            relations: None,
            applied: None,
        }
    }

    #[test]
    fn agent_max_sensitivity_default_is_internal() {
        let policies = PolicyConfig::default();
        assert_eq!(agent_max_sensitivity(&policies), Sensitivity::Internal);
    }

    #[test]
    fn agent_max_sensitivity_from_egress_control() {
        let policies = PolicyConfig {
            rules: vec![PolicyRule::EgressControl {
                max_sensitivity: Sensitivity::Confidential,
                destinations: vec![],
            }],
        };
        assert_eq!(agent_max_sensitivity(&policies), Sensitivity::Confidential);
    }

    #[test]
    fn evaluate_on_create_agent_size_limit() {
        let policies = PolicyConfig {
            rules: vec![PolicyRule::AgentProposalLimit {
                max_operations: 1,
                max_content_length: 10,
            }],
        };
        let mut proposal = empty_proposal();
        proposal.operations = vec![
            crate::types::proposal::Operation::Create {
                id: "op1".to_string(),
                order: 1,
                node: crate::types::ContextNode {
                    id: crate::types::NodeId {
                        id: "n1".to_string(),
                        namespace: None,
                    },
                    node_type: crate::types::NodeType::Goal,
                    status: crate::types::NodeStatus::Accepted,
                    title: None,
                    description: None,
                    content: "short".to_string(),
                    text_range: None,
                    metadata: crate::types::NodeMetadata {
                        created_at: "t".to_string(),
                        created_by: "t".to_string(),
                        modified_at: "t".to_string(),
                        modified_by: "t".to_string(),
                        tags: None,
                        implemented_in_commit: None,
                        referenced_in_commits: None,
                        version: 1,
                        sensitivity: None,
                        content_hash: None,
                        source_attribution: None,
                        ip_classification: None,
                        license: None,
                    },
                    relationships: None,
                    relations: None,
                    referenced_by: None,
                    source_files: None,
                    decision: None,
                    rationale: None,
                    alternatives: None,
                    decided_at: None,
                    state: None,
                    assignee: None,
                    due_date: None,
                    dependencies: None,
                    severity: None,
                    likelihood: None,
                    mitigation: None,
                    question: None,
                    answer: None,
                    answered_at: None,
                    constraint: None,
                    reason: None,
                },
            },
            crate::types::proposal::Operation::Create {
                id: "op2".to_string(),
                order: 2,
                node: crate::types::ContextNode {
                    id: crate::types::NodeId {
                        id: "n2".to_string(),
                        namespace: None,
                    },
                    node_type: crate::types::NodeType::Goal,
                    status: crate::types::NodeStatus::Accepted,
                    title: None,
                    description: None,
                    content: "short".to_string(),
                    text_range: None,
                    metadata: crate::types::NodeMetadata {
                        created_at: "t".to_string(),
                        created_by: "t".to_string(),
                        modified_at: "t".to_string(),
                        modified_by: "t".to_string(),
                        tags: None,
                        implemented_in_commit: None,
                        referenced_in_commits: None,
                        version: 1,
                        sensitivity: None,
                        content_hash: None,
                        source_attribution: None,
                        ip_classification: None,
                        license: None,
                    },
                    relationships: None,
                    relations: None,
                    referenced_by: None,
                    source_files: None,
                    decision: None,
                    rationale: None,
                    alternatives: None,
                    decided_at: None,
                    state: None,
                    assignee: None,
                    due_date: None,
                    dependencies: None,
                    severity: None,
                    likelihood: None,
                    mitigation: None,
                    question: None,
                    answer: None,
                    answered_at: None,
                    constraint: None,
                    reason: None,
                },
            },
        ];
        let violations = evaluate_on_create(&proposal, "agent", &policies);
        assert!(
            !violations.is_empty(),
            "should reject agent: too many operations"
        );
        assert!(violations.iter().any(|v| v.rule == "agent_proposal_limit"));
    }

    #[test]
    fn evaluate_on_create_human_bypasses_agent_limits() {
        let policies = PolicyConfig {
            rules: vec![PolicyRule::AgentProposalLimit {
                max_operations: 0,
                max_content_length: 0,
            }],
        };
        let proposal = empty_proposal();
        let violations = evaluate_on_create(&proposal, "human", &policies);
        assert!(
            violations.is_empty(),
            "human should not be affected by agent limits"
        );
    }

    #[test]
    fn evaluate_on_apply_change_window_blocks() {
        // Create a policy with change window that blocks all days
        let policies = PolicyConfig {
            rules: vec![PolicyRule::ChangeWindow {
                allowed_days: vec![], // no days allowed
                allowed_hour_start: 0,
                allowed_hour_end: 0,
            }],
        };
        let proposal = empty_proposal();
        let violations = evaluate_on_apply(&proposal, "human", &policies);
        assert!(
            !violations.is_empty(),
            "should block apply outside change window"
        );
    }

    #[test]
    fn evaluate_on_apply_agent_restriction() {
        let policies = PolicyConfig {
            rules: vec![PolicyRule::AgentRestriction {
                blocked_actions: vec!["apply".to_string()],
            }],
        };
        let proposal = empty_proposal();
        let violations = evaluate_on_apply(&proposal, "agent", &policies);
        assert!(
            !violations.is_empty(),
            "agent should be blocked from applying"
        );
        assert!(violations.iter().any(|v| v.rule == "agent_restriction"));
    }

    #[test]
    fn check_agent_restricted_node_modification_blocks_high_sensitivity() {
        let policies = PolicyConfig {
            rules: vec![PolicyRule::EgressControl {
                max_sensitivity: Sensitivity::Internal,
                destinations: vec![],
            }],
        };
        let mut proposal = empty_proposal();
        proposal.operations = vec![crate::types::proposal::Operation::Create {
            id: "op1".to_string(),
            order: 1,
            node: crate::types::ContextNode {
                id: crate::types::NodeId {
                    id: "restricted-node".to_string(),
                    namespace: None,
                },
                node_type: crate::types::NodeType::Goal,
                status: crate::types::NodeStatus::Accepted,
                title: None,
                description: None,
                content: "secret".to_string(),
                text_range: None,
                metadata: crate::types::NodeMetadata {
                    created_at: "t".to_string(),
                    created_by: "t".to_string(),
                    modified_at: "t".to_string(),
                    modified_by: "t".to_string(),
                    tags: None,
                    implemented_in_commit: None,
                    referenced_in_commits: None,
                    version: 1,
                    sensitivity: Some(Sensitivity::Restricted),
                    content_hash: None,
                    source_attribution: None,
                    ip_classification: None,
                    license: None,
                },
                relationships: None,
                relations: None,
                referenced_by: None,
                source_files: None,
                decision: None,
                rationale: None,
                alternatives: None,
                decided_at: None,
                state: None,
                assignee: None,
                due_date: None,
                dependencies: None,
                severity: None,
                likelihood: None,
                mitigation: None,
                question: None,
                answer: None,
                answered_at: None,
                constraint: None,
                reason: None,
            },
        }];
        let violations = check_agent_restricted_node_modification(&proposal, "agent", &policies);
        assert!(
            !violations.is_empty(),
            "agent should be blocked from modifying restricted nodes"
        );
        assert!(violations
            .iter()
            .any(|v| v.rule == "agent_restricted_modification"));

        // Human should not be blocked
        let human_violations =
            check_agent_restricted_node_modification(&proposal, "human", &policies);
        assert!(
            human_violations.is_empty(),
            "human should not be restricted"
        );
    }
}
