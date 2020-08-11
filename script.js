// ==UserScript==
// @name         dmarket
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://dmarket.com/ingame-items/item-list/csgo-skins?categoryPath=pistol,smg,rifle,sniper%20rifle,shotgun,machinegun
// ==/UserScript==

const DAY_IN_MILIS = 86400000;

let reloadButton;
let marketSide;
let searchInput;
let checkedItems = [];
let itemIndex = 0;
let itemsToUpdate = [];
let isSniping = false;
let lastUpdate = Date.now();

window.addEventListener("load", () => {
	initialize();
	createExtraButtons();
	setInterval(checkIfSnipingWorks, 10000);
});

function reload() {
	lastUpdate = Date.now();
	isSniping = true;
	reloadButton.click();
	setTimeout(getElements, 5000);
}

function checkIfSnipingWorks() {
	if (isSniping) {
		let currentTime = Date.now();
		if (currentTime - lastUpdate > 10000) {
			console.log("need to reload");
			reload();
		}
	}
}

function setInputField(inputField, value) {
	let lastValue = inputField.value;
	inputField.value = value;
	let event = new Event("input", { bubbles: true });
	let tracker = inputField._valueTracker;
	if (tracker) {
		tracker.setValue(lastValue);
	}
	inputField.dispatchEvent(event);
}

async function getWeaponNames() {
	const response = await fetch(
		"http://localhost:5000/api/v1/update_prices/weapon_names"
	);
	return await response.json();
}

function getInfo(name, price) {
	return new Promise((resolve, reject) => {
		fetch(
			`http://localhost:5000/api/v1/sniper/get_dmarket_info?name=${name}&price=${price}`
		).then((response) => {
			resolve(response.json());
		});
	});
}

function updatePrices() {
	getWeaponNames().then((result) => {
		itemsToUpdate = result;
		searchItems();
	});
}

async function searchItems() {
	setInputField(searchInput, itemsToUpdate[itemIndex].name);

	try {
		var { name, lowestPrice } = await getLowestPrice();
	} catch (error) {
		console.log(error);
		continueUpdating();
		return;
	}

	const median = await getRecentSales();

	await fetch(
		`http://localhost:5000/api/v1/update_prices/update_dmarket_prices?name=${name}&lowestPrice=${lowestPrice}&median=${median}`
	);

	if (itemsToUpdate.length - 1 === itemIndex) {
		console.log("Done updating");
		return;
	}

	continueUpdating();
}

const getLowestPrice = () =>
	new Promise((resolve, reject) => {
		setTimeout(() => {
			let item = marketSide.querySelector(".c-asset__inner");
			if (item === null || item === undefined) return reject("No item found");

			let infoButton = item.querySelector(".c-asset__action--info");

			let name = item.querySelector(".c-asset__img").alt;
			let lowestPrice = item.querySelector(".c-asset__priceNumber").innerText;
			lowestPrice = lowestPrice.replace(/\s+/g, "");

			infoButton.click();
			resolve({ name: name, lowestPrice: lowestPrice });
		}, 7000);
	});

const getRecentSales = () =>
	new Promise((resolve) => {
		setTimeout(() => {
			let median = 0;
			let recentSalesRows = document.querySelectorAll(".c-assetPreview__row");
			let closeButton = document.querySelector(".c-dialogHeader__close");
			if (recentSalesRows === null || recentSalesRows === undefined) {
				closeButton.click();
				return resolve(median);
			}

			let recentSales = [];

			recentSalesRows.forEach((row) => {
				let date = row.childNodes[0].innerText;
				let unixDate = Date.parse(date);
				let currentTime = Date.now();
				if (currentTime > unixDate + DAY_IN_MILIS * 14) return;

				let price = row.childNodes[1].innerText;
				price = price.replace(/\s+/g, "");

				recentSales.push(parseFloat(price));
			});

			if (recentSales.length > 0) {
				recentSales.sort((a, b) => a - b);
				if (recentSales.length % 2 === 1) {
					median = parseFloat(
						recentSales[Math.floor(recentSales.length / 2)]
					).toFixed(2);
				}
				if (recentSales.length % 2 === 0) {
					median = (
						(parseFloat(recentSales[recentSales.length / 2 - 1]) +
							parseFloat(recentSales[recentSales.length / 2])) /
						2
					).toFixed(2);
				}
			}

			closeButton.click();
			resolve(median);
		}, 1500);
	});

function continueUpdating() {
	itemIndex++;
	searchItems();
}

async function getElements() {
	let allItems = marketSide.querySelectorAll(".c-asset__inner");

	allItems.forEach(async (x, index, array) => {
		let clickThis = x.querySelector(".c-asset__figure");
		let name = clickThis.querySelector(".c-asset__img").alt;
		let price = x.querySelector(".c-asset__priceNumber").innerText;
		price = price.replace(/\s+/g, "");

		if (checkedItems.some((x) => x.name === name && x.price === price)) {
			if (index === allItems.length - 1) setTimeout(reload, 1000);
			return;
		}

		if (!name.includes("Souvenir")) {
			let result = await getInfo(name, price);
			checkedItems.push({ name: name, price: price });
		}

		if (index === allItems.length - 1) setTimeout(reload, 1000);
	});

	if (checkedItems.length > 500) {
		checkedItems.splice(0, checkedItems.length - 250);
	}
}

function createExtraButtons() {
	marketSide.querySelector("counter").innerHTML +=
		'<div id="start-button" class="c-exchangeButtons__item">start</div><div id="stop-button" class="c-exchangeButtons__item">stop</div><div id="update-button" class="c-exchangeButtons__item">update</div>';
	document
		.getElementById("start-button")
		.addEventListener("click", reload, false);
	document
		.getElementById("stop-button")
		.addEventListener("click", getWeaponNames, false);
	document
		.getElementById("update-button")
		.addEventListener("click", updatePrices, false);
}

function initialize() {
	marketSide = document.querySelector("market-side");
	reloadButton = marketSide.querySelector(".o-filter--refresh");
	searchInput = marketSide.querySelector(".o-filter__searchInput");
}
