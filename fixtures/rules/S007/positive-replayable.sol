// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
}

contract Replayable {
    IQorePQC constant PQC = IQorePQC(0x0000000000000000000000000000000000000a01);
    bytes public guardianKey;

    constructor(bytes memory key) payable {
        guardianKey = key;
    }

    function withdraw(address payable to, uint256 amount, bytes calldata sig) external {
        bytes memory message = abi.encodePacked(to, amount);
        require(PQC.pqcVerify(guardianKey, sig, message), "bad signature"); // expect S007
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
