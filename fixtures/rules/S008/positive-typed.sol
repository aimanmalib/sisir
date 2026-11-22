// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IPaidPQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external payable returns (bool valid);
}

contract TypedValue {
    IPaidPQC constant PQC = IPaidPQC(0x0000000000000000000000000000000000000a01);

    function verify(bytes calldata pubkey, bytes calldata sig, bytes calldata message) external payable {
        require(PQC.pqcVerify{value: msg.value}(pubkey, sig, message), "bad signature"); // expect S008
    }
}
