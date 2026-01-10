// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EscrowVault.sol";

/**
 * @title SettlementReceipt
 * @notice ERC-721 NFT representing conditional settlement claims
 * @dev Each receipt represents a redemption that can be redeemed immediately (with haircut) 
 *      or after FDC confirmation (full amount)
 */
contract SettlementReceipt {
    // ERC-721 state
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Receipt metadata
    struct ReceiptMetadata {
        uint256 redemptionId;
        address asset;
        uint256 amount;
        uint256 haircutRate;      // Scaled: 1000000 = 100%
        uint256 createdAt;
        uint256 fdcRoundId;
        bool redeemed;
        address lp;                // LP address if LP-funded, address(0) if user-wait
    }
    
    mapping(uint256 => ReceiptMetadata) public receiptMetadata; // tokenId => metadata
    mapping(uint256 => uint256) public redemptionToTokenId;     // redemptionId => tokenId
    
    EscrowVault public immutable escrowVault;
    address public owner;
    uint256 public nextTokenId;
    
    string public constant name = "FLIP Settlement Receipt";
    string public constant symbol = "FLIP-RECEIPT";
    
    event ReceiptMinted(
        uint256 indexed tokenId,
        uint256 indexed redemptionId,
        address indexed to,
        address asset,
        uint256 amount,
        uint256 haircutRate
    );
    
    event ReceiptRedeemed(
        uint256 indexed tokenId,
        uint256 indexed redemptionId,
        address indexed redeemer,
        uint256 amount,
        bool immediate
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "SettlementReceipt: not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == address(escrowVault),
            "SettlementReceipt: not authorized"
        );
        _;
    }
    
    constructor(address _escrowVault) {
        escrowVault = EscrowVault(_escrowVault);
        owner = msg.sender;
    }
    
    /**
     * @notice Mint a new settlement receipt
     * @param _to Address to mint receipt to
     * @param _redemptionId Redemption ID
     * @param _asset Asset being redeemed
     * @param _amount Amount being redeemed
     * @param _haircutRate Haircut rate (scaled: 1000000 = 100%)
     * @param _lp LP address (address(0) if user-wait path)
     * @return tokenId Minted token ID
     */
    function mintReceipt(
        address _to,
        uint256 _redemptionId,
        address _asset,
        uint256 _amount,
        uint256 _haircutRate,
        address _lp
    ) external onlyAuthorized returns (uint256 tokenId) {
        require(_to != address(0), "SettlementReceipt: invalid recipient");
        require(redemptionToTokenId[_redemptionId] == 0, "SettlementReceipt: receipt exists");
        
        tokenId = ++nextTokenId;
        
        receiptMetadata[tokenId] = ReceiptMetadata({
            redemptionId: _redemptionId,
            asset: _asset,
            amount: _amount,
            haircutRate: _haircutRate,
            createdAt: block.timestamp,
            fdcRoundId: 0,
            redeemed: false,
            lp: _lp
        });
        
        redemptionToTokenId[_redemptionId] = tokenId;
        _mint(_to, tokenId);
        
        emit ReceiptMinted(tokenId, _redemptionId, _to, _asset, _amount, _haircutRate);
        return tokenId;
    }
    
    /**
     * @notice Redeem receipt immediately at haircut (uses LP liquidity)
     * @param _receiptId Receipt token ID
     */
    function redeemNow(uint256 _receiptId) external {
        require(_isAuthorized(msg.sender, _receiptId), "SettlementReceipt: not authorized");
        
        ReceiptMetadata storage metadata = receiptMetadata[_receiptId];
        require(!metadata.redeemed, "SettlementReceipt: already redeemed");
        require(metadata.lp != address(0), "SettlementReceipt: no LP liquidity");
        
        // Calculate amount after haircut
        uint256 haircutAmount = (metadata.amount * metadata.haircutRate) / 1000000;
        uint256 redeemAmount = metadata.amount - haircutAmount;
        
        metadata.redeemed = true;
        
        // In production, this would transfer funds from escrow/LP to user
        // For now, emit event - actual transfer handled by EscrowVault/FLIPCore
        
        emit ReceiptRedeemed(_receiptId, metadata.redemptionId, msg.sender, redeemAmount, true);
    }
    
    /**
     * @notice Redeem receipt after FDC confirmation (full amount, no haircut)
     * @param _receiptId Receipt token ID
     */
    function redeemAfterFDC(uint256 _receiptId) external {
        require(_isAuthorized(msg.sender, _receiptId), "SettlementReceipt: not authorized");
        
        ReceiptMetadata storage metadata = receiptMetadata[_receiptId];
        require(!metadata.redeemed, "SettlementReceipt: already redeemed");
        
        // Check escrow status - must be Released
        EscrowVault.EscrowStatus status = escrowVault.getEscrowStatus(metadata.redemptionId);
        require(
            status == EscrowVault.EscrowStatus.Released,
            "SettlementReceipt: escrow not released"
        );
        
        metadata.redeemed = true;
        
        // In production, this would transfer full amount from escrow to user
        // For now, emit event - actual transfer handled by EscrowVault/FLIPCore
        
        emit ReceiptRedeemed(_receiptId, metadata.redemptionId, msg.sender, metadata.amount, false);
    }
    
    /**
     * @notice Get receipt metadata
     * @param _receiptId Receipt token ID
     * @return metadata Receipt metadata
     */
    function getReceiptMetadata(uint256 _receiptId)
        external
        view
        returns (ReceiptMetadata memory metadata)
    {
        return receiptMetadata[_receiptId];
    }
    
    /**
     * @notice Update FDC round ID (called by EscrowVault when FDC attests)
     * @param _redemptionId Redemption ID
     * @param _fdcRoundId FDC round ID
     */
    function updateFDCRoundId(uint256 _redemptionId, uint256 _fdcRoundId) external {
        require(
            msg.sender == address(escrowVault),
            "SettlementReceipt: only escrow vault"
        );
        
        uint256 tokenId = redemptionToTokenId[_redemptionId];
        require(tokenId > 0, "SettlementReceipt: receipt not found");
        
        receiptMetadata[tokenId].fdcRoundId = _fdcRoundId;
    }
    
    // ERC-721 Implementation
    
    function balanceOf(address _owner) external view returns (uint256) {
        require(_owner != address(0), "SettlementReceipt: zero address");
        return _balances[_owner];
    }
    
    function ownerOf(uint256 _tokenId) external view returns (address) {
        address owner_ = _owners[_tokenId];
        require(owner_ != address(0), "SettlementReceipt: invalid token");
        return owner_;
    }
    
    function approve(address _to, uint256 _tokenId) external {
        address owner_ = _owners[_tokenId];
        require(_to != owner_, "SettlementReceipt: approval to owner");
        require(
            msg.sender == owner_ || _operatorApprovals[owner_][msg.sender],
            "SettlementReceipt: not authorized"
        );
        
        _tokenApprovals[_tokenId] = _to;
        emit Approval(owner_, _to, _tokenId);
    }
    
    function getApproved(uint256 _tokenId) external view returns (address) {
        require(_owners[_tokenId] != address(0), "SettlementReceipt: invalid token");
        return _tokenApprovals[_tokenId];
    }
    
    function setApprovalForAll(address _operator, bool _approved) external {
        require(_operator != msg.sender, "SettlementReceipt: approve to self");
        _operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }
    
    function isApprovedForAll(address _owner, address _operator) external view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }
    
    function transferFrom(address _from, address _to, uint256 _tokenId) external {
        require(_isAuthorized(msg.sender, _tokenId), "SettlementReceipt: not authorized");
        require(_to != address(0), "SettlementReceipt: transfer to zero address");
        
        _transfer(_from, _to, _tokenId);
    }
    
    function safeTransferFrom(address _from, address _to, uint256 _tokenId) external {
        safeTransferFrom(_from, _to, _tokenId, "");
    }
    
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) public {
        require(_isAuthorized(msg.sender, _tokenId), "SettlementReceipt: not authorized");
        require(_to != address(0), "SettlementReceipt: transfer to zero address");
        
        _transfer(_from, _to, _tokenId);
        
        if (_to.code.length > 0) {
            try IERC721TokenReceiver(_to).onERC721Received(msg.sender, _from, _tokenId, _data)
                returns (bytes4 retval) {
                require(retval == IERC721TokenReceiver.onERC721Received.selector, "SettlementReceipt: invalid receiver");
            } catch (bytes memory) {
                revert("SettlementReceipt: transfer to non-ERC721Receiver");
            }
        }
    }
    
    // Internal functions
    
    function _mint(address _to, uint256 _tokenId) internal {
        require(_to != address(0), "SettlementReceipt: mint to zero address");
        require(_owners[_tokenId] == address(0), "SettlementReceipt: token exists");
        
        _balances[_to]++;
        _owners[_tokenId] = _to;
        
        emit Transfer(address(0), _to, _tokenId);
    }
    
    function _transfer(address _from, address _to, uint256 _tokenId) internal {
        require(_owners[_tokenId] == _from, "SettlementReceipt: transfer from incorrect owner");
        
        delete _tokenApprovals[_tokenId];
        _balances[_from]--;
        _balances[_to]++;
        _owners[_tokenId] = _to;
        
        emit Transfer(_from, _to, _tokenId);
    }
    
    function _isAuthorized(address _operator, uint256 _tokenId) internal view returns (bool) {
        address owner_ = _owners[_tokenId];
        return (
            _operator == owner_ ||
            _tokenApprovals[_tokenId] == _operator ||
            _operatorApprovals[owner_][_operator]
        );
    }
    
    // Events
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);
}

// Minimal ERC721Receiver interface
interface IERC721TokenReceiver {
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes calldata _data
    ) external returns (bytes4);
}


