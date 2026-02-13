//! TLS certificate management for QUIC/HTTP/3 transport.
//!
//! QUIC mandates TLS 1.3. This module loads PEM certificates from disk
//! for production, or generates self-signed certificates for development.
//! The resulting `quinn::ServerConfig` is used by the HTTP/3 server.

use std::path::Path;
use std::sync::Arc;

use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};

/// Load TLS certificate chain and private key from PEM files.
pub fn load_certs_from_pem(
    cert_path: &Path,
    key_path: &Path,
) -> Result<(Vec<CertificateDer<'static>>, PrivateKeyDer<'static>), Box<dyn std::error::Error + Send + Sync>>
{
    let cert_pem = std::fs::read(cert_path)
        .map_err(|e| format!("failed to read TLS cert {}: {}", cert_path.display(), e))?;
    let key_pem = std::fs::read(key_path)
        .map_err(|e| format!("failed to read TLS key {}: {}", key_path.display(), e))?;

    let certs: Vec<CertificateDer<'static>> = rustls_pemfile::certs(&mut &cert_pem[..])
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("invalid PEM cert: {}", e))?;

    let key = rustls_pemfile::private_key(&mut &key_pem[..])
        .map_err(|e| format!("invalid PEM key: {}", e))?
        .ok_or("no private key found in PEM file")?;

    if certs.is_empty() {
        return Err("no certificates found in PEM file".into());
    }

    Ok((certs, key))
}

/// Generate a self-signed TLS certificate for development.
/// Valid for `localhost` and `127.0.0.1`, expires in 365 days.
/// NOT suitable for production — use real certificates from a CA.
pub fn generate_dev_cert(
) -> Result<(Vec<CertificateDer<'static>>, PrivateKeyDer<'static>), Box<dyn std::error::Error + Send + Sync>>
{
    let subject_alt_names = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    let certified_key = rcgen::generate_simple_self_signed(subject_alt_names)
        .map_err(|e| format!("failed to generate dev cert: {}", e))?;

    let cert_der = CertificateDer::from(certified_key.cert.der().to_vec());
    let key_der = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(
        certified_key.key_pair.serialize_der(),
    ));

    Ok((vec![cert_der], key_der))
}

/// Build a `quinn::ServerConfig` from TLS certificates.
///
/// - Sets ALPN to `h3` for HTTP/3 negotiation.
/// - Enables 0-RTT for fast reconnection (laptop sleep/wake, VPN reconnect).
/// - Configures QUIC keep-alive (15s) and idle timeout (5 min) for SSE streams.
pub fn build_quinn_server_config(
    certs: Vec<CertificateDer<'static>>,
    key: PrivateKeyDer<'static>,
) -> Result<quinn::ServerConfig, Box<dyn std::error::Error + Send + Sync>> {
    let mut tls_config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| format!("TLS config error: {}", e))?;

    // HTTP/3 ALPN negotiation
    tls_config.alpn_protocols = vec![b"h3".to_vec()];
    // Enable 0-RTT early data for fast reconnection
    tls_config.max_early_data_size = u32::MAX;

    let quic_crypto = quinn::crypto::rustls::QuicServerConfig::try_from(tls_config)
        .map_err(|e| format!("QUIC crypto config error: {}", e))?;

    let mut server_config = quinn::ServerConfig::with_crypto(Arc::new(quic_crypto));

    // Transport tuning for SSE streaming + API latency
    let mut transport = quinn::TransportConfig::default();
    // QUIC-level keep-alive prevents NAT/firewall timeouts on long-lived SSE streams
    transport.keep_alive_interval(Some(std::time::Duration::from_secs(15)));
    // 5-minute idle timeout: SSE streams with keep-alive will never hit this;
    // abandoned connections are cleaned up after 5 minutes of silence.
    transport.max_idle_timeout(Some(
        quinn::IdleTimeout::try_from(std::time::Duration::from_secs(300))
            .map_err(|e| format!("invalid idle timeout: {}", e))?,
    ));
    server_config.transport_config(Arc::new(transport));

    Ok(server_config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_dev_cert_succeeds() {
        let (certs, _key) = generate_dev_cert().expect("dev cert generation failed");
        assert_eq!(certs.len(), 1, "should produce exactly one certificate");
    }

    #[test]
    fn build_server_config_from_dev_cert() {
        let (certs, key) = generate_dev_cert().unwrap();
        let config = build_quinn_server_config(certs, key);
        assert!(config.is_ok(), "server config should build from dev cert");
    }
}
