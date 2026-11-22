// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
}

contract MappingNonce {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    mapping(address => uint256) public nonces;
    mapping(address => bytes) public keys;

    function act(address signer, bytes calldata sig, uint256 amount) external {
        bytes32 digest = keccak256(abi.encode(block.chainid, address(this), signer, nonces[signer], amount));
        (bool ok, bytes memory ret) = PQC_VERIFY.staticcall(
            abi.encodeWithSignature("pqcVerify(bytes,bytes,bytes)", keys[signer], sig, abi.encodePacked(digest))
        );
        require(ok && ret.length >= 32 && abi.decode(ret, (bool)), "bad signature");
        nonces[signer] += 1;
    }

    // Callers build the message, so this helper cannot be judged on its own.
    function _verify(bytes memory key, bytes calldata sig, bytes memory message) internal view returns (bool) {
        return IQorePQC(PQC_VERIFY).pqcVerify(key, sig, message);
    }
}
