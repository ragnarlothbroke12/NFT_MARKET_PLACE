// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract ERC21market is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;
    uint256[] private listedTokenIds;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public listings;

    event NFTMinted(uint256 indexed tokenId, address indexed to, string uri);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTCancelled(uint256 indexed tokenId, address indexed seller);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);

    constructor() ERC721("ERC21market", "EMP") Ownable(msg.sender) {}

    // ✅ Mint NFT
    function safeMint(string memory uri) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit NFTMinted(tokenId, msg.sender, uri);
        return tokenId;
    }

    // ✅ List NFT for sale
    function listing(uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be greater than zero");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner or approved");
        require(listings[tokenId].price == 0, "Already listed");

        listings[tokenId] = Listing(msg.sender, price);
        listedTokenIds.push(tokenId);

        emit NFTListed(tokenId, msg.sender, price);
    }

    // ✅ Buy listed NFT
    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory item = listings[tokenId];
        require(item.price > 0, "NFT not listed");
        require(msg.value == item.price, "Incorrect payment");

        _transfer(item.seller, msg.sender, tokenId);
        delete listings[tokenId];
        removeTokenFromListed(tokenId);
        payable(item.seller).transfer(msg.value);

        emit NFTPurchased(tokenId, msg.sender, item.seller, item.price);
    }

    // ✅ Remove from listed array
    function removeTokenFromListed(uint256 tokenId) internal {
        uint length = listedTokenIds.length;
        for (uint i = 0; i < length; i++) {
            if (listedTokenIds[i] == tokenId) {
                listedTokenIds[i] = listedTokenIds[length - 1];
                listedTokenIds.pop();
                break;
            }
        }
    }

    // ✅ Cancel listing
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "You are not the seller");
        delete listings[tokenId];
        removeTokenFromListed(tokenId);
        emit NFTCancelled(tokenId, msg.sender);
    }

    // ✅ Get all listings
    function getAllListings() external view returns (Listing[] memory, uint256[] memory) {
        uint256 count = listedTokenIds.length;
        Listing[] memory allListings = new Listing[](count);
        uint256[] memory tokenIds = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = listedTokenIds[i];
            allListings[i] = listings[tokenId];
            tokenIds[i] = tokenId;
        }
        return (allListings, tokenIds);
    }

    // ✅ Internal check
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        return (
            spender == ownerOf(tokenId) ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(ownerOf(tokenId), spender)
        );
    }

    // ✅ Overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
