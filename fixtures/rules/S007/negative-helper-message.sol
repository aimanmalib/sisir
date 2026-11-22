// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IQorePQC {
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool valid);
}

// The message is built in a helper and the nonce is read through a local, as in the workshop vault.
contract HelperMessage {
    IQorePQC internal constant PQC_VERIFY = IQorePQC(0x0000000000000000000000000000000000000a01);
    bytes public guardianKey;
    uint256 public nonce;

    error BadPqcSignature();

    constructor(bytes memory key) payable {
        guardianKey = key;
    }

    function withdrawalMessage(address to, uint256 amount, uint256 nonce_) public view returns (bytes memory) {
        return abi.encodePacked("HelperMessage:withdraw:v1", block.chainid, address(this), to, amount, nonce_);
    }

    function withdraw(address payable to, uint256 amount, bytes calldata sig) external {
        uint256 n = nonce;
        if (!PQC_VERIFY.pqcVerify(guardianKey, sig, withdrawalMessage(to, amount, n))) revert BadPqcSignature();
        nonce = n + 1;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
