// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
}

contract Partial {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    IQorePQC constant PQC = IQorePQC(PQC_VERIFY);
    bytes public key;
    uint256 public nonce;

    // Bound to this contract and a nonce, but not to the chain.
    function act(uint256 amount, bytes calldata sig) external {
        require(PQC.pqcVerify(key, sig, abi.encode(address(this), nonce, amount)), "bad signature"); // expect S007
        nonce++;
    }

    // The caller supplies the whole message, so nothing is bound.
    function check(bytes calldata sig, bytes calldata message) external view returns (bool) {
        (bool ok, bytes memory ret) = PQC_VERIFY.staticcall(abi.encodeCall(IQorePQC.pqcVerify, (key, sig, message))); // expect S007
        return ok && ret.length >= 32 && abi.decode(ret, (bool));
    }
}
