// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
}

contract StaticNonce {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    bytes public key;
    uint256 public nonce;
    uint256 public epoch;

    constructor(bytes memory key_) {
        key = key_;
        epoch++;
    }

    // Bound to the chain and this contract, but nonce never moves, so one signature passes forever.
    function act(uint256 amount, bytes calldata sig) external view returns (bool) {
        return PQC.pqcVerify(key, sig, abi.encode(block.chainid, address(this), nonce, amount)); // expect S007
    }

    // epoch only moves in the constructor, so it is fixed for every call.
    function settle(uint256 amount, bytes calldata sig) external view returns (bool) {
        return PQC.pqcVerify(key, sig, abi.encode(block.chainid, address(this), epoch, amount)); // expect S007
    }

    // A parameter that the function bumps is still chosen by the caller.
    function claim(uint256 count, bytes calldata sig) external view returns (bool) {
        count++;
        return PQC.pqcVerify(key, sig, abi.encode(block.chainid, address(this), count)); // expect S007
    }
}
