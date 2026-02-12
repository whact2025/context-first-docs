//! Sensitivity labels and IP classification for content protection.
//! Nodes carry a sensitivity level; agents are restricted from reading above their allowed level.

use serde::{Deserialize, Serialize};

/// Sensitivity level for content classification (ordered low→high).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sensitivity {
    Public,
    Internal,
    Confidential,
    Restricted,
}

impl Default for Sensitivity {
    fn default() -> Self {
        Sensitivity::Internal
    }
}

impl Sensitivity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Sensitivity::Public => "public",
            Sensitivity::Internal => "internal",
            Sensitivity::Confidential => "confidential",
            Sensitivity::Restricted => "restricted",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "public" => Some(Sensitivity::Public),
            "internal" => Some(Sensitivity::Internal),
            "confidential" => Some(Sensitivity::Confidential),
            "restricted" => Some(Sensitivity::Restricted),
            _ => None,
        }
    }
}

/// IP classification for provenance and attribution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum IpClassification {
    TradeSecret,
    PatentPending,
    Proprietary,
    Internal,
    Open,
}

/// Source attribution for content provenance.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceAttribution {
    HumanAuthored,
    AgentGenerated,
    Imported,
    Derived,
}

/// Extended metadata for IP protection, attached to proposals/nodes.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sensitivity: Option<Sensitivity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_classification: Option<IpClassification>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_attribution: Option<SourceAttribution>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    /// SHA-256 hash of the content at apply time (for fingerprinting).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
}

/// Compute SHA-256 content hash.
pub fn content_hash(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Check if an agent is allowed to read content at the given sensitivity level.
/// Agents are allowed up to `max_sensitivity` (inclusive).
pub fn agent_can_read(
    content_sensitivity: Sensitivity,
    max_agent_sensitivity: Sensitivity,
) -> bool {
    content_sensitivity <= max_agent_sensitivity
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sensitivity_ordering() {
        assert!(Sensitivity::Public < Sensitivity::Internal);
        assert!(Sensitivity::Internal < Sensitivity::Confidential);
        assert!(Sensitivity::Confidential < Sensitivity::Restricted);
    }

    #[test]
    fn default_is_internal() {
        assert_eq!(Sensitivity::default(), Sensitivity::Internal);
    }

    #[test]
    fn agent_can_read_at_or_below_max() {
        assert!(agent_can_read(Sensitivity::Public, Sensitivity::Internal));
        assert!(agent_can_read(Sensitivity::Internal, Sensitivity::Internal));
        assert!(!agent_can_read(
            Sensitivity::Confidential,
            Sensitivity::Internal
        ));
        assert!(!agent_can_read(
            Sensitivity::Restricted,
            Sensitivity::Internal
        ));
        assert!(agent_can_read(
            Sensitivity::Confidential,
            Sensitivity::Confidential
        ));
        assert!(agent_can_read(
            Sensitivity::Restricted,
            Sensitivity::Restricted
        ));
    }

    #[test]
    fn content_hash_is_deterministic() {
        let h1 = content_hash("hello world");
        let h2 = content_hash("hello world");
        assert_eq!(h1, h2);
        let h3 = content_hash("different content");
        assert_ne!(h1, h3);
    }

    #[test]
    fn content_hash_is_sha256_hex() {
        let hash = content_hash("test");
        // SHA-256 hash is 64 hex chars
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn sensitivity_from_str() {
        assert_eq!(
            Sensitivity::from_str_opt("public"),
            Some(Sensitivity::Public)
        );
        assert_eq!(
            Sensitivity::from_str_opt("internal"),
            Some(Sensitivity::Internal)
        );
        assert_eq!(
            Sensitivity::from_str_opt("confidential"),
            Some(Sensitivity::Confidential)
        );
        assert_eq!(
            Sensitivity::from_str_opt("restricted"),
            Some(Sensitivity::Restricted)
        );
        assert_eq!(Sensitivity::from_str_opt("unknown"), None);
    }

    #[test]
    fn ip_classification_serde() {
        let json = serde_json::to_string(&IpClassification::TradeSecret).unwrap();
        assert_eq!(json, "\"trade-secret\"");
        let parsed: IpClassification = serde_json::from_str("\"patent-pending\"").unwrap();
        assert_eq!(parsed, IpClassification::PatentPending);
    }

    #[test]
    fn source_attribution_serde() {
        let json = serde_json::to_string(&SourceAttribution::AgentGenerated).unwrap();
        assert_eq!(json, "\"agent-generated\"");
        let parsed: SourceAttribution = serde_json::from_str("\"human-authored\"").unwrap();
        assert_eq!(parsed, SourceAttribution::HumanAuthored);
    }
}
