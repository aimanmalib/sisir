// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract CheckedNote {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;
    string public receipts;

    error BadNote();

    function checkout(string calldata note) external returns (bytes memory) {
        _checkNote(bytes(note));
        return _callNative(bytes(string.concat('{"record":{"note":"', note, '"}}')));
    }

    function tagged(string calldata tag) external returns (bytes memory) {
        if (bytes(tag).length == 0 || bytes(tag).length > 32) revert BadNote();
        return _callNative(bytes(string.concat('{"tag":"', tag, '"}')));
    }

    function _callNative(bytes memory payload) private returns (bytes memory) {
        (bool ok, bytes memory ret) = BRIDGE.call(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), receipts, payload));
        require(ok && ret.length > 0, "bridge failed");
        return ret;
    }

    function _checkNote(bytes memory n) private pure {
        if (n.length == 0 || n.length > 140) revert BadNote();
        for (uint256 i; i < n.length; ++i) {
            bytes1 b = n[i];
            if (b < 0x20 || b > 0x7e || b == '"' || b == "\\") revert BadNote();
        }
    }
}
