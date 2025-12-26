// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStateConnector
 * @notice Interface for Flare Data Connector (FDC) State Connector contract
 * @dev FDC provides cross-chain attestations with 3-5 minute latency
 *      Attestations include Merkle roots for verification
 */
interface IStateConnector {
    /**
     * @notice Emitted when a new attestation is published
     * @param _requestId The request ID (indexed for filtering)
     * @param _merkleRoot Merkle root of the attested data
     * @param _timestamp Timestamp of the attestation
     */
    event Attestation(uint256 indexed _requestId, bytes32 _merkleRoot, uint256 _timestamp);

    /**
     * @notice Get the current State Connector round ID
     * @return _roundId Current round ID
     */
    function getStateConnectorRound() external view returns (uint256 _roundId);

    /**
     * @notice Get attestation data for a specific round
     * @param _roundId The round ID to query
     * @return _merkleRoot Merkle root of the attested data
     * @return _timestamp Timestamp of the attestation
     */
    function getAttestation(uint256 _roundId)
        external
        view
        returns (bytes32 _merkleRoot, uint256 _timestamp);
}



