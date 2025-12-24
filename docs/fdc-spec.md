# Flare Data Connector (FDC) Interface (IStateConnector)

Event:
- `event Attestation(uint256 indexed _requestId, bytes32 _merkleRoot, uint256 _timestamp);`

Functions:
- `getStateConnectorRound() -> uint256 roundId`
- `getAttestation(uint256 roundId) -> (bytes32 merkleRoot, uint256 timestamp)`

Integration Notes:
- Attestation latency typically 3-5 minutes
- Verifier APIs per chain (XRP/BTC/DOGE/EVM) plus DA layer
- Listen to `Attestation` events to match redemption request IDs
- Merkle proofs verified against `_merkleRoot`
