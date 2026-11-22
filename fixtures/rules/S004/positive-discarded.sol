// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract Discarded {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    uint256 public released;

    function release(bytes calldata pubkey, bytes calldata sig, uint256 amount) external {
        PQC.pqcVerify(pubkey, sig, abi.encode(block.chainid, address(this), amount, released)); // expect S004
        released += amount;
    }
}
