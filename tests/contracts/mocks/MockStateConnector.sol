// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../contracts/interfaces/IStateConnector.sol";

contract MockStateConnector is IStateConnector {
    uint256 public currentRound;
    mapping(uint256 => bytes32) public merkleRoots;
    mapping(uint256 => uint256) public roundTimestamps;

    function getCurrentRound() external view override returns (uint256) {
        return currentRound;
    }

    function getAttestation(uint256 _roundId)
        external
        view
        override
        returns (bytes32 _merkleRoot, uint256 _timestamp)
    {
        return (merkleRoots[_roundId], roundTimestamps[_roundId]);
    }

    function submitAttestation(uint256 _requestId, bytes32 _merkleRoot) external {
        currentRound++;
        merkleRoots[currentRound] = _merkleRoot;
        roundTimestamps[currentRound] = block.timestamp;
        emit Attestation(_requestId, _merkleRoot, block.timestamp);
    }
}



