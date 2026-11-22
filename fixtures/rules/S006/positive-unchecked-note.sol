// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract UncheckedNote {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;
    string public receipts;

    function checkout(string calldata note) external returns (bytes memory) {
        return _callNative(bytes(string.concat('{"record":{"note":"', note, '"}}'))); // expect S006
    }

    function direct(bytes calldata memo) external {
        bytes memory payload = abi.encodePacked('{"memo":"', memo, '"}'); // expect S006
        (bool ok, bytes memory ret) = BRIDGE.call(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), receipts, payload));
        require(ok && ret.length > 0, "bridge failed");
    }

    function _callNative(bytes memory payload) private returns (bytes memory) {
        (bool ok, bytes memory ret) = BRIDGE.call(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), receipts, payload));
        require(ok && ret.length > 0, "bridge failed");
        return ret;
    }
}
