// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;

contract RawVerifier {
    function valid(bytes calldata pubkey, bytes calldata sig, bytes calldata message) public view returns (bool) {
        bool ok;
        bytes memory out;
        (ok, out) = PQC_VERIFY.staticcall(abi.encodeCall(IQorePQC.pqcVerify, (pubkey, sig, message))); // expect S002
        return ok && abi.decode(out, (bool));
    }
}
