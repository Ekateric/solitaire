/**
 * Created by eradak01 on 25.11.2015.
 * Solitaire game
 */

/**
 * Служебная функция для склеивания двух объектов по примеру метода jQuery extend
 * @returns {*}
 */
function extend(){
	for(var i = 1; i < arguments.length; i++)
		for(var key in arguments[i])
			if(arguments[i].hasOwnProperty(key))
				arguments[0][key] = arguments[i][key];
	return arguments[0];
}

/**
 * Конструктор карты
 * @param params
 * @constructor
 */
var Card = function(params) {
	this.num = params.num;
	this.suit = params.suit;
	this.id = params.id;
	this.src = params.num + '/card_' + params.num + '_' + params.suit + '.png';
	this.show = false;
	this.drag = false;
	this.animated = false;
	this.coords = [null, null];
};

var Solitaire = function(elem, params) {
	this.elem = document.getElementById(elem);
	this.context = this.elem.getContext("2d");

	this.params = extend({
		//values
		numbers: ['A','2','3','4','5','6','7','8','9','10','V','D','K'], //от туза до короля
		suits: ['spades', 'clubs', 'hearts', 'diamonds'], 	//пики, трефы,червы,бубны

		blocksCount: 7, //количество стопок с картами
		animationSpeed: 200,
		animationStep: 30,

		//sizes
		canvasSize: [this.elem.width, this.elem.height],
		canvasScale: 1,
		canvasMaxWidth: null,
		canvasOffset: [0, 0],
		cardSize: [82, 116],
		cardSizeDelta: 1.02, 	//поправка на тень в картинках
		cardIndent: [15, 15],
		startPosition: [0, 0],
		mainCardSpase: 2, 		//отступы между картами в основной колоде
		blockCardSpase: 5, 		//отступы между картами в нижних стопках
		blockBigCardSpase: 23, 	//отступы между картами в нижних стопках, когда предыдущая карта открыта
		imgSrc: '/img/',

		//elements

		//callbacks
		afterLoad: null,	//после стартовой анимации
		afterStep: null,	//после хода
		afterCancel: null,	//после отмены хода
		onEnd: null			//после успешного завершения игры

	}, params);

	window.requestAnimationFrame = (function(){
		return  window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(callback){
				window.setTimeout(callback, 1000 / 60);
			};
	})();

	window.cancelAnimationFrame = (function(){
		return  window.cancelAnimationFrame ||
			window.webkitCancelAnimationFrame ||
			window.mozCancelAnimationFrame ||
			window.oCancelAnimationFrame ||
			window.msCancelAnimationFrame ||
			function(id){
				clearTimeout(id);
			};
	})();

	this.init();
	this._loadImages();
	this.attachEvents();
};

Solitaire.prototype = {
	init: function() {
		this.canPlay = false; 	//флаг, отвечающий за то, можно ли совершать пользователю действия с картами
		this.isAnimate = false; //проходят ли анимационные действия сейчас
		this.isDrag = false;	//драгается ли какой-то элемент сейчас
		this.gameEnd = false;	//окончена ли игра
		this.prevStep = {
			type: null,
			elems: []
		};		//предыдущий ход
		this.dragObject = null; //информация о драге
		this.resizeTimer = null;//таймер для ресайза не в каждую единицу времени

		this.params.canvasOffset = this._getOffset();

		this.cards = this._createCardsMass();				//общая колода
		this.cardsBlocks = this._createCardsBlocks();		//стопки карт от 1 до 7
		this.cardsMainDeck = this._createcardsMainDeck();	//оставшаяся колода для переворачивания
		this.cardsOutputs = this._createCardsOutputs();		//блоки для размещения итоговых мини-колод пасьянса

		this.canvasTable = this._drawTable();	//Закешируем картинку фона, чтобы не перерисовывать ее каждый раз
	},

	/**
	 * получаем координаты относительно страницы
	 * @returns {*[]}
	 * @private
	 */
	_getOffset: function() {
		var elem = this.elem,
			box = elem.getBoundingClientRect(),
			body = document.body,
			docEl = document.documentElement,
			scroll = [
				window.pageXOffset || docEl.scrollLeft || body.scrollLeft,
				window.pageYOffset || docEl.scrollTop || body.scrollTop
			],
			client = [
				docEl.clientLeft || body.clientLeft || 0,
				docEl.clientTop || body.clientTop || 0
			];

		return [
			box.left + scroll[0] - client[0],
			box.top + scroll[1] - client[1]
		]
	},

	/**
	 * Создаем общую рандомную колоду карт
	 * @returns {Array}
	 * @private
	 */
	_createCardsMass: function() {
		var numsMass = [].concat(this.params.numbers),
			numsLength =  numsMass.length,
			suitsLength = this.params.suits.length,
			cardsLength = numsLength * suitsLength, //сколько карт должно получиться
			cardsCounter = 0,
			newCardsMass = []; //массив новых карт

		while(cardsCounter - cardsLength < 0 || numsMass.length == 0) {
			var newCardNumberIndex = Math.floor(Math.random() * numsMass.length),//рандомный индекс номера карты
				newCardSuitIndex = Math.floor(Math.random() * this.params.suits.length), 	//рандомный индекс масти карты
				cardObj = {
					num: numsMass[newCardNumberIndex],
					suit: this.params.suits[newCardSuitIndex],
					id: cardsCounter
				},
				sameCardsCount = 0, 	//счетчик карт с одинаковым номером
				isAlreadyAdd = false; 	//флаг неуникальности карты

			//пробегаемся по массиву созданных карт, чтобы исключить повторений
			for(var newCardsCounter = 0; newCardsCounter < newCardsMass.length; newCardsCounter ++) {
				if (newCardsMass[newCardsCounter].num == cardObj.num) {
					if (newCardsMass[newCardsCounter].suit == cardObj.suit) {
						isAlreadyAdd = true;
					}
					sameCardsCount++
				}
			}

			//Если все карты одного номера есть во всех мастях - удаляем это значение из массива значений
			if (sameCardsCount == suitsLength) {
				numsMass.splice(newCardNumberIndex, 1);
			}

			//Если карта уникальна - добавляем ее в массив
			if (!isAlreadyAdd) {
				var newCard = new Card(cardObj);
				newCardsMass.push(newCard);
				cardsCounter ++
			}
		}

		return newCardsMass
	},

	/**
	 * Создаем из основной колоды стопки - объекты с координатами положения и с массивами индексов карт из колоды
	 * @returns {Object}
	 * @private
	 */
	_createCardsBlocks: function() {
		var blocksObj = {},
		//startIndent = (Math.ceil(this.cardsMainDeck.elems.length / 8) - 1)*this.params.mainCardSpase,
			startIndent = 2*this.params.mainCardSpase,
			startCoords = [this.params.startPosition[0] + startIndent, this.params.startPosition[1] + startIndent];

		for (var blocksCounter = 0; blocksCounter < this.params.blocksCount; blocksCounter++) {
			var sinceIndex = 0;
			blocksObj[blocksCounter] = {};

			//Записывам координаты каждой стопки
			blocksObj[blocksCounter].coords = [
				this.params.startPosition[0] + (this.params.cardSize[0] + this.params.cardIndent[0]) * blocksCounter,
				this.params.startPosition[1] + this.params.cardSize[1] + this.params.cardIndent[1]
			];

			//Массив для будущих ссылок на карты
			blocksObj[blocksCounter].elems = [];

			//Считаем, с какого индекса брать элементы из основного массива
			for (var sinceCounter = 0; sinceCounter - blocksCounter < 1; sinceCounter ++) {
				sinceIndex += sinceCounter;
			}

			//Записывам индексы элементов основного массива в стопки карт
			for (var cardBlockCounter = 0; cardBlockCounter - blocksCounter < 1; cardBlockCounter ++) {
				var newCardIndex = sinceIndex + cardBlockCounter;

				blocksObj[blocksCounter].elems.push(newCardIndex);

				this.cards[newCardIndex].coords = startCoords;
				this.cards[newCardIndex].animationCoords = [
					blocksObj[blocksCounter].coords[0],
					blocksObj[blocksCounter].coords[1] + cardBlockCounter * this.params.blockCardSpase
				];

				this.cards[newCardIndex].block = blocksCounter;
			}

			//Записываем высоту всего блока
			blocksObj[blocksCounter].height = this.cards[blocksObj[blocksCounter].elems[blocksObj[blocksCounter].elems.length - 1]].animationCoords[1] + this.params.cardSize[1] - blocksObj[blocksCounter].coords[1];
		}
		return blocksObj
	},

	/**
	 * Создаем из основной колоды карт стопку карт для переворачивания
	 * @returns {Object}
	 * @private
	 */
	_createcardsMainDeck: function() {
		var mainBlock = {},
			sinceIndex = 0;

		//Координаты левой части колоды рубашкой вверх
		mainBlock.reverseCoords = this.params.startPosition;
		//Координаты правой перевернутой части колоды
		mainBlock.inverseCoords = [this.params.startPosition[0] + this.params.cardSize[0] + this.params.cardIndent[0], this.params.startPosition[1]];

		mainBlock.elems = [];

		//Считаем, с какого индекса брать элементы из основного массива
		for (var sinceCounter = 0; sinceCounter < this.params.blocksCount; sinceCounter ++) {
			sinceIndex += sinceCounter + 1
		}
		//Записывам индексы элементов основного массива в основную колоду
		for (var cardMainCounter = 0; cardMainCounter < this.cards.length - sinceIndex; cardMainCounter ++) {
			this.cards[sinceIndex + cardMainCounter].coords = mainBlock.inverseCoords;
			mainBlock.elems.push(sinceIndex + cardMainCounter);
		}
		//какая карта открыта сейчас
		mainBlock.shownCard = null;

		return mainBlock
	},

	/**
	 * Создаем объект со стопками для сбора карт по мастям
	 * @returns {{}}
	 * @private
	 */
	_createCardsOutputs: function() {
		var outputsObj = {};

		for (var outputsCounter = 0; outputsCounter < this.params.suits.length; outputsCounter++) {
			outputsObj[outputsCounter] = {};
			outputsObj[outputsCounter].elems = [];
			outputsObj[outputsCounter].coords = [this.params.startPosition[0] + (this.params.cardSize[0] + this.params.cardIndent[0]) * (outputsCounter + 3), this.params.startPosition[1]];
		}

		return outputsObj
	},

	/**
	 *  * Получаем координаты для карт в блоках снизу
	 * @param blockIndex {number} индекс блока
	 * @param cardIndex {number} индекс карты в блоке
	 * @returns {Array}
	 * @private
	 */
	_getCardsInBlockCoords: function(blockIndex, cardIndex) {
		var cardBlock = this.cardsBlocks[blockIndex],
			newCoords = [];

		if(cardIndex == 0) {
			newCoords = cardBlock.coords
		} else {
			var cardIndent = 0;

			for(var prevCardIterator = 0; cardIndex - prevCardIterator > 0; prevCardIterator++) {
				var prevCard = this.cards[cardBlock.elems[prevCardIterator]];

				if (prevCard.show) {
					cardIndent += this.params.blockBigCardSpase;
				} else {
					cardIndent += this.params.blockCardSpase;
				}
			}

			newCoords = [
				cardBlock.coords[0],
				cardBlock.coords[1] + cardIndent
			];
		}

		return newCoords
	},

	/**
	 * Пересчет высоты колонки
	 * @param blockIndex
	 * @private
	 */
	_setCardsBlockHeight: function(blockIndex) {
		var block = this.cardsBlocks[blockIndex];
		if(block.elems.length > 0) {
			block.height = this.cards[block.elems[block.elems.length - 1]].coords[1] + this.params.cardSize[1] - block.coords[1];
		}
	},

	/**
	 * Рисуем стол и места для карт
	 * @private
	 */
	_drawTable: function() {
		var _that = this,
			tableCanvas = document.createElement('canvas'),
			tableContext = tableCanvas.getContext("2d"),
			ringCanvas = _that._drawGradientRing(),
			rectangleOptions = {
				width: _that.params.cardSize[0],
				height: _that.params.cardSize[1],
				radius: 10,
				fill: true,
				stroke: false
			};

		tableCanvas.width = _that.params.canvasSize[0];
		tableCanvas.height = _that.params.canvasSize[1];

		tableContext.fillStyle = "rgba(59, 105, 124, 0.15)";
		tableContext.fillRect(0, 0, _that.params.canvasSize[0], _that.params.canvasSize[1]);

		tableContext.strokeStyle = "rgba(59, 105, 124, 0.3)";
		tableContext.fillStyle = "rgba(59, 105, 124, 0.3)";

		//для основной колоды
		_that._drawRoundedRectangle(tableContext, rectangleOptions, _that.cardsMainDeck.reverseCoords);
		_that._drawRoundedRectangle(tableContext, rectangleOptions, _that.cardsMainDeck.inverseCoords);

		//для стопок снизу
		for(var cardsBlocksCount in _that.cardsBlocks) {
			_that._drawRoundedRectangle(tableContext, rectangleOptions, _that.cardsBlocks[cardsBlocksCount].coords);
		}

		//для сборщиков карт
		for(var cardsOutputsCount in _that.cardsOutputs) {
			_that._drawRoundedRectangle(tableContext, rectangleOptions, _that.cardsOutputs[cardsOutputsCount].coords);
		}

		//рисуем градиентный круг на стопке для переворачивания
		tableContext.drawImage(ringCanvas, 0, 0, _that.params.canvasSize[0], _that.params.canvasSize[1]);

		return tableCanvas
	},

	/**
	 * Рисуем прямоугольник с закругленными краями
	 * @param context
	 * @param params
	 * @param coords
	 * @private
	 */
	_drawRoundedRectangle: function(context, params, coords) {
		if (typeof params.stroke == "undefined" ) {
			params.stroke = true;
		}
		if (typeof params.radius === "undefined") {
			params.radius = 5;
		}
		context.beginPath();
		context.moveTo(coords[0] + params.radius, coords[1]);
		context.lineTo(coords[0] + params.width - params.radius, coords[1]);
		context.quadraticCurveTo(coords[0] + params.width, coords[1], coords[0] + params.width, coords[1] + params.radius);
		context.lineTo(coords[0] + params.width, coords[1] + params.height - params.radius);
		context.quadraticCurveTo(coords[0] + params.width, coords[1] + params.height, coords[0] + params.width - params.radius, coords[1] + params.height);
		context.lineTo(coords[0] + params.radius, coords[1] + params.height);
		context.quadraticCurveTo(coords[0], coords[1] + params.height, coords[0], coords[1] + params.height - params.radius);
		context.lineTo(coords[0], coords[1] + params.radius);
		context.quadraticCurveTo(coords[0], coords[1], coords[0] + params.radius, coords[1]);
		context.closePath();
		if (params.stroke) {
			context.stroke();
		}
		if (params.fill) {
			context.fill();
		}
	},

	/**
	 * Градиентное кольцо
	 * @private
	 */
	_drawGradientRing: function() {
		var _that = this,
			ringCanvas = document.createElement('canvas'),
			ringContext = ringCanvas.getContext("2d"),
			strokeWidth = 4,
			radius = _that.params.cardSize[0]*.24,
			coordsX = _that.params.startPosition[0] + _that.params.cardSize[0]/2,
			coordsY = _that.params.startPosition[1] + _that.params.cardSize[1]/2,
			goldGradient = ringContext.createLinearGradient(0, -radius*.5, 0, radius);

		ringCanvas.width = _that.params.canvasSize[0];
		ringCanvas.height = _that.params.canvasSize[1];

		goldGradient.addColorStop(0, '#f5d38c');
		goldGradient.addColorStop(1, '#d0a659');

		//кольцо-тень
		ringContext.save();
		ringContext.beginPath();
		ringContext.translate(coordsX + 1, coordsY + 1);
		ringContext.arc(0, 0, radius, 0, 2 * Math.PI, false);
		ringContext.lineWidth = strokeWidth;
		ringContext.strokeStyle = 'rgba(0,132,194,.3)';
		ringContext.stroke();
		ringContext.restore();

		//градиентное кольцо
		ringContext.save();
		ringContext.beginPath();
		ringContext.translate(coordsX, coordsY);
		ringContext.arc(0, 0, radius, 0, 2 * Math.PI, false);
		ringContext.lineWidth = strokeWidth;
		ringContext.strokeStyle = goldGradient;
		ringContext.stroke();
		ringContext.restore();

		return ringCanvas
	},

	/**
	 * Предзагрузка картинок
	 * @private
	 */
	_loadImages: function() {
		var _that = this;

		//Загружает один ресурс из объекта загружаемых картинок по индексу
		function loadOneImage(iterator) {
			var newImage = new Image();
			newImage.addEventListener('load', function() {
				_that.images[iterator].img = newImage;
				_that.images[iterator].loaded = true;

				if(isAllLoaded()) {
					_that._resizeEvent();
					_that._firstAnimation();
				}
			}, false);
			newImage.src = _that.params.imgSrc + iterator;
		}

		//Считает, все ли картинки загружены
		function isAllLoaded() {
			var allLoaded = true;

			for (var imageCounter in _that.images) {
				if (!_that.images[imageCounter].loaded) {
					allLoaded = false;
					break
				}
			}

			return allLoaded
		}

		_that.images = {}; 									//массив предзагружаемых картинок
		_that.images[this.params.backImg] = {loaded: false};//картинка с рубашкой

		for (var cardsIterator = 0; _that.cards.length - cardsIterator > 0; cardsIterator ++) {
			_that.images[_that.cards[cardsIterator].src] = {loaded: false};
		}

		for (var imageIterator in _that.images) {
			loadOneImage(imageIterator);
		}
	},

	/**
	 * Раскладываем колоду
	 * @private
	 */
	_firstAnimation: function() {
		var _that = this;

		_that.isAnimate = true;
		_that._draw();

		function callCardAnimate(cardId, cardTime, lastCard, shownCard) {
			setTimeout(function () {
				if(shownCard) _that.cards[cardId].show = true;
				_that.cards[cardId].animated = true;
				_that._animateCard(cardId, _that.params.animationSpeed, lastCard);

				if (lastCard && typeof _that.params.afterLoad == 'function') {
					setTimeout(function() {
						_that.params.afterLoad();
					}, _that.params.animationSpeed);
				}
			}, cardTime);
		}

		for(var cardsBlocksCounter in _that.cardsBlocks) {
			var cardsBlockElems = _that.cardsBlocks[cardsBlocksCounter].elems,
				cardsBlockElemsLength = cardsBlockElems.length;

			for(var cardsBlocksCardCounter = 0; cardsBlockElemsLength - cardsBlocksCardCounter > 0 ; cardsBlocksCardCounter++) {
				var cardsBlockCard = _that.cards[cardsBlockElems[cardsBlocksCardCounter]],
					isLast = _that.params.blocksCount - cardsBlocksCounter == 1 && cardsBlockElemsLength - cardsBlocksCardCounter == 1, //пооследняя анимируемая карта
					isShown = cardsBlocksCardCounter - cardsBlocksCounter == 0, //последняя карта в колоде
					cardsCount = 0; // сколько карт до этого уже расположено в остальных рядах

				for (var cardsIterator = 0; cardsBlocksCardCounter - cardsIterator > 0 ; cardsIterator ++) {
					cardsCount +=  _that.params.blocksCount - cardsIterator
				}

				callCardAnimate(cardsBlockCard.id, (_that.params.blocksCount - cardsBlocksCounter + cardsCount) * _that.params.animationSpeed, isLast, isShown);
			}
		}
	},

	/**
	 * Анимируем одну карту
	 * @param cardId
	 * @param animationTime
	 * @param lastCard
	 * @private
	 */
	_animateCard: function(cardId, animationTime, lastCard) {
		var _that = this,
			card = _that.cards[cardId],
			iteration =  animationTime / _that.params.animationStep,
			coordsStep = [
				parseInt((card.animationCoords[0] - card.coords[0])/iteration),
				parseInt((card.animationCoords[1] - card.coords[1])/iteration)
			],
			newAnimationTime = animationTime - _that.params.animationStep;

		if(newAnimationTime > 0) {
			card.coords = [
				card.coords[0] + coordsStep[0],
				card.coords[1] + coordsStep[1]
			];

			setTimeout(function () {
				_that._animateCard(cardId, newAnimationTime, lastCard);
			}, _that.params.animationStep);

		} else {
			card.coords = card.animationCoords;
			card.animated = false;

			//последняя анимируемая карта
			if(lastCard) {
				_that.isAnimate = false;
				_that.canPlay = true;
			}
		}
	},

	/**
	 * Рисуем всё (вызывается первый раз после загрузки всех картинок)
	 */
	_draw: function() {
		var _that = this,
			scale = _that.params.canvasScale,
			backImage = _that.images[_that.params.backImg].img,
			imageDelta = _that.params.cardSize[0] / backImage.width * _that.params.cardSizeDelta,
			newCardSize = [backImage.width*imageDelta*scale, backImage.height*imageDelta*scale],
			mainCardSpace = _that.params.mainCardSpase*scale,
			animatedCards = [];

		//1 - зачистка
		_that.context.clearRect(0, 0, _that.params.canvasSize[0]*scale, _that.params.canvasSize[1]*scale);

		//2 - фон
		_that.context.drawImage(_that.canvasTable, 0, 0, _that.params.canvasSize[0]*scale, _that.params.canvasSize[1]*scale);

		//3 - основная колода
		if (_that.cardsMainDeck.elems.length) {
			var mainCardActive = _that.cardsMainDeck.shownCard;

			if (mainCardActive == null) {
				//Это присвоение нужно для отображения количества рубашек в колоде слева
				mainCardActive = _that.cardsMainDeck.elems.length;
			} else {
				var mainBlockActiveCard = _that.cards[_that.cardsMainDeck.elems[mainCardActive]];

				if (mainBlockActiveCard.animated) {
					animatedCards.push(mainBlockActiveCard.id);
				} else if(!mainBlockActiveCard.drag) {
					//рисуем активную карту, если она не тащится и не анимируется
					_that.context.drawImage(_that.images[mainBlockActiveCard.src].img, mainBlockActiveCard.coords[0]*scale, mainBlockActiveCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				}

				//если после открытой карты была еще хоть одна карта, то рисуем ее
				//нужно для того, чтобы она показывалась под текущей активной, когда ее пытаются тащить
				if (_that.cardsMainDeck.elems.length - mainCardActive > 1 && (mainBlockActiveCard.animated || mainBlockActiveCard.drag)) {
					var mainBlockPrevActiveCard = _that.cards[_that.cardsMainDeck.elems[mainCardActive + 1]];
					//рисуем предыдущую активную карту
					_that.context.drawImage(_that.images[mainBlockPrevActiveCard.src].img, mainBlockPrevActiveCard.coords[0]*scale, mainBlockPrevActiveCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				}
			}

			if (mainCardActive != 0) {
				//рисуем рубашки в колоде слева
				for(var mainBlockBgCount = 0; mainBlockBgCount < Math.ceil(mainCardActive / 8); mainBlockBgCount ++ ) {
					_that.context.drawImage(backImage, (_that.cardsMainDeck.reverseCoords[0] + mainBlockBgCount*mainCardSpace)*scale, (_that.cardsMainDeck.reverseCoords[1] + mainBlockBgCount*mainCardSpace)*scale, newCardSize[0], newCardSize[1]);
				}
			}
		}

		//4 - колоды для сборки по мастям
		for(var outputsCounter in _that.cardsOutputs) {
			var outputElems = _that.cardsOutputs[outputsCounter].elems;

			if (outputElems.length) {
				var lastOutputCard = _that.cards[outputElems[outputElems.length - 1]];

				if (lastOutputCard.animated) {
					animatedCards.push(lastOutputCard.id);
				} else if(!lastOutputCard.drag) {
					_that.context.drawImage(_that.images[lastOutputCard.src].img, lastOutputCard.coords[0]*scale, lastOutputCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				}

				//Рисуем препоследнюю карту, если последняя анимируется или таскается
				if (outputElems.length > 1 && (lastOutputCard.animated || lastOutputCard.drag)) {
					var prevOutputCard = _that.cards[outputElems[outputElems.length - 2]];
					_that.context.drawImage(_that.images[prevOutputCard.src].img, prevOutputCard.coords[0]*scale, prevOutputCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				}
			}
		}

		//5 - стопки с картами
		for(var cardsBlocksCounter in _that.cardsBlocks) {
			var cardsBlockElems = _that.cardsBlocks[cardsBlocksCounter].elems;

			for(var cardsBlocksCardCounter = 0; cardsBlocksCardCounter < cardsBlockElems.length; cardsBlocksCardCounter ++) {
				var cardsBlockCard = _that.cards[cardsBlockElems[cardsBlocksCardCounter]];

				if (cardsBlockCard.animated) {
					animatedCards.push(cardsBlockCard.id);
				} else if (!cardsBlockCard.drag) {
					if (cardsBlockCard.show) {
						_that.context.drawImage(_that.images[cardsBlockCard.src].img, cardsBlockCard.coords[0] * scale, cardsBlockCard.coords[1] * scale, newCardSize[0], newCardSize[1]);
					} else {
						_that.context.drawImage(backImage, cardsBlockCard.coords[0] * scale, cardsBlockCard.coords[1] * scale, newCardSize[0], newCardSize[1]);
					}
				}
			}
		}

		//6 - драгаемые карты
		if (_that.dragObject != null) {
			for(var dragCardsCounter = 0; _that.dragObject.elems.length - dragCardsCounter > 0; dragCardsCounter++ ) {
				var dragCard = _that.cards[_that.dragObject.elems[dragCardsCounter]];
				_that.context.drawImage(_that.images[dragCard.src].img, dragCard.coords[0]*scale, dragCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
			}
		}

		//7 - анимируемые карты
		if(animatedCards.length) {
			for(var animatedCounter = 0; animatedCards.length - animatedCounter > 0; animatedCounter++ ) {
				var animatedCard = _that.cards[animatedCards[animatedCounter]];
				if (animatedCard.show) {
					_that.context.drawImage(_that.images[animatedCard.src].img, animatedCard.coords[0]*scale, animatedCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				} else {
					_that.context.drawImage(backImage, animatedCard.coords[0]*scale, animatedCard.coords[1]*scale, newCardSize[0], newCardSize[1]);
				}
			}
		}

		if (_that.isAnimate) {
			requestAnimationFrame(function() {
				_that._draw();
			});
		}
	},

	/**
	 * Листаем карты из основной колоды
	 * @param direction {number} направление пролистывания
	 * @private
	 */
	_openMainDeck: function(direction) {
		var _that = this,
			mainCards = _that.cardsMainDeck.elems;

		if (mainCards.length) {
			if (direction == 1) {
				//Если нет вообще открытых карт
				if (_that.cardsMainDeck.shownCard == null) {
					//открываем последнюю карту
					_that.cardsMainDeck.shownCard = mainCards.length - 1;
					_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = true;

				} else {
					_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = false;

					//Если добрались до первой карты в колоде
					if (_that.cardsMainDeck.shownCard == 0) {
						//не открываем ни одной
						_that.cardsMainDeck.shownCard = null;
					} else {
						_that.cardsMainDeck.shownCard--;
						_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = true;
					}
				}

				_that.prevStep.type = 'open';
				_that.prevStep.elems = [];

				if (typeof _that.params.afterStep == 'function') {
					_that.params.afterStep();
				}

			} else if(direction == -1) {
				if (_that.cardsMainDeck.shownCard == null) {
					_that.cardsMainDeck.shownCard = 0;
					_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = true;

				} else {
					_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = false;

					if (mainCards.length - _that.cardsMainDeck.shownCard == 1) {
						_that.cardsMainDeck.shownCard = null;
					} else {
						_that.cardsMainDeck.shownCard++;
						_that.cards[mainCards[_that.cardsMainDeck.shownCard]].show = true;
					}
				}
			}

			_that._draw();
		}
	},

	/**
	 * Удаляем карту отовсюду, где бы она ни была
	 * @param card {{}}
	 * @param addToHistory {boolean}
	 */
	_removeCard: function(card, addToHistory) {
		//1 - если карта лежала в блоке снизу
		if(typeof card.block != 'undefined' && card.block != null) {
			for(var cardsBlockCounter = 0; cardsBlockCounter < this.cardsBlocks[card.block].elems.length; cardsBlockCounter++ ) {
				var cardBlockIndx = this.cardsBlocks[card.block].elems.length - cardsBlockCounter - 1, //ищем с последнего - так быстрее
					cardBlockId = this.cardsBlocks[card.block].elems[cardBlockIndx];

				if (cardBlockId == card.id) {
					this.cardsBlocks[card.block].elems.splice(cardBlockIndx, 1);
					break
				}
			}
			if(typeof addToHistory != 'undefined' && addToHistory) {
				this.prevStep.elems.push({
					cardId: card.id,
					fromEl: 'block',
					fromPos: card.block
				});
			}

			card.block = null;

			//2 - если карта лежала в сборщике по мастям
		} else if(typeof card.output != 'undefined' && card.output != null) {
			for(var cardsOutputCounter = 0; cardsOutputCounter < this.cardsOutputs[card.output].elems.length; cardsOutputCounter++ ) {
				var cardOutputIndx = this.cardsOutputs[card.output].elems.length - cardsOutputCounter - 1, //ищем с последнего - так быстрее
					cardOutputId = this.cardsOutputs[card.output].elems[cardOutputIndx];

				if (cardOutputId == card.id) {
					this.cardsOutputs[card.output].elems.splice(cardOutputIndx, 1);

					if (card.num == 'A') {
						this.cardsOutputs[card.output].suit = null;
					}
					break
				}
			}
			if(typeof addToHistory != 'undefined' && addToHistory) {
				this.prevStep.elems.push({
					cardId: card.id,
					fromEl: 'output',
					fromPos: card.output
				});
			}
			card.output = null;

			//3 - если карта лежала в главной колоде
		} else {
			for(var cardsMainCounter = 0; cardsMainCounter < this.cardsMainDeck.elems.length; cardsMainCounter++ ) {
				var cardMainBlockId = this.cardsMainDeck.elems[cardsMainCounter];

				if (cardMainBlockId == card.id) {
					this.cardsMainDeck.elems.splice(cardsMainCounter, 1);
					//Если это не последняя карта в колоде, то нужно показать предыдущую открытую карту,
					// (если она была) которая окажется на месте удаленной
					if (this.cardsMainDeck.elems.length - cardsMainCounter == 0) {
						this.cardsMainDeck.shownCard = null;
					} else {
						this.cards[this.cardsMainDeck.elems[cardsMainCounter]].show = true;
					}
					if(typeof addToHistory != 'undefined' && addToHistory) {
						this.prevStep.elems.push({
							cardId: card.id,
							fromEl: 'main',
							fromPos: cardsMainCounter
						});
					}
					break;
				}
			}
		}
		if (typeof this.params.afterStep == 'function' && typeof addToHistory != 'undefined' && addToHistory) {
			this.params.afterStep();
		}
	},

	/**
	 * Пробуем положить карту в сборщик карт по мастям
	 * @param card
	 * @param outputIndx
	 * @returns {boolean}
	 */
	_tryAddToOutput: function(card, outputIndx) {
		var _that = this,
			isAdded = false,
			output = _that.cardsOutputs[outputIndx];

		if (output.elems.length) {
			var lastOutputElem = _that.cards[output.elems[output.elems.length - 1]];
			//подходит ли масть
			if (typeof output.suit != 'undefined' &&
				output.suit == card.suit &&
				(card.num - lastOutputElem.num == 1 ||
				(lastOutputElem.num == 'A' && card.num == '2') ||
				(lastOutputElem.num == 'D' && card.num == 'K') ||
				(lastOutputElem.num == 'V' && card.num == 'D') ||
				(lastOutputElem.num == '10' && card.num == 'V'))) {

				isAdded = true;
			}
			//если элементов еще нет, но кладем туза
		} else if(card.num == 'A') {
			output.suit = card.suit;
			isAdded = true;
		}

		return isAdded
	},

	/**
	 * Пробуем положить карту в блок снизу
	 * @param card
	 * @param blockIndx
	 */
	_tryAddToBlock: function(card, blockIndx) {
		var _that = this,
			isAdded = false,
			cardsBlock = _that.cardsBlocks[blockIndx],
			cardsBlockelemsCount = cardsBlock.elems.length || 0;

		if (cardsBlockelemsCount) {
			var lastСardsBlockElem = _that.cards[cardsBlock.elems[cardsBlockelemsCount - 1]];
			//подходит ли масть и значение карты
			if ((lastСardsBlockElem.num - card.num == 1 ||
				(lastСardsBlockElem.num == '2' && card.num == 'A') ||
				(lastСardsBlockElem.num == 'K' && card.num == 'D') ||
				(lastСardsBlockElem.num == 'D' && card.num == 'V') ||
				(lastСardsBlockElem.num == 'V' && card.num == '10'))
				&&
				(((lastСardsBlockElem.suit == 'spades' || lastСardsBlockElem.suit == 'clubs') && (card.suit == 'hearts' || card.suit == 'diamonds')) ||
				(lastСardsBlockElem.suit == 'hearts' || lastСardsBlockElem.suit == 'diamonds') && (card.suit == 'spades' || card.suit == 'clubs'))) {
				isAdded = true;
			}
			//если элементов в блоке нет, но кладем короля
		} else if(card.num == 'K') {
			isAdded = true;
		}

		return isAdded
	},

	/**
	 * Переносим карту в сборщик
	 * @param card
	 * @param outputIndex
	 * @param addToHistory
	 * @param withAnimation
	 * @private
	 */
	_addToOutput: function(card, outputIndex, addToHistory, withAnimation) {
		this._removeCard(card, addToHistory);
		this.cardsOutputs[outputIndex].elems.push(card.id);
		card.output = outputIndex;

		if (typeof withAnimation != 'undefined' && withAnimation) {
			this.isAnimate = true;
			this.canPlay = false;

			card.drag = false;
			card.animated = true;
			card.animationCoords = this.cardsOutputs[outputIndex].coords;

			this._animateCard(card.id, this.params.animationSpeed *.8, true);

		} else {
			card.coords = this.cardsOutputs[outputIndex].coords;
		}

		//Масть собрана!
		if (card.num == 'K') {
			this.cardsOutputs[outputIndex].finish = true;
			this._checkGameEnd();
		} else {
			this.cardsOutputs[outputIndex].finish = false;
		}
	},

	/**
	 * Переносим карту в блок снизу
	 * @param card
	 * @param blockIndex
	 * @param addToHistory
	 * @param isLast
	 * @param withAnimation
	 * @private
	 */
	_addToBlock: function(card, blockIndex, addToHistory, isLast, withAnimation) {
		var _that = this;

		_that._removeCard(card, addToHistory);
		_that.cardsBlocks[blockIndex].elems.push(card.id);
		card.block = blockIndex;

		if (typeof withAnimation != 'undefined' && withAnimation) {
			_that.isAnimate = true;
			_that.canPlay = false;

			card.drag = false;
			card.animated = true;
			card.animationCoords = _that._getCardsInBlockCoords(blockIndex, _that.cardsBlocks[blockIndex].elems.length - 1);

			_that._animateCard(card.id, _that.params.animationSpeed *.8, isLast);

			setTimeout(function() {
				_that._setCardsBlockHeight(blockIndex); //Пересчитываем высоту блока
			}, _that.params.animationSpeed *.8);

		} else {
			card.coords = _that._getCardsInBlockCoords(blockIndex, _that.cardsBlocks[blockIndex].elems.length - 1);
			_that._setCardsBlockHeight(blockIndex); //Пересчитываем высоту блока
		}
	},

	/**
	 * Переносим крату обратно в главную колоду
	 * @param card
	 * @param mainPos
	 * @param withAnimation
	 * @private
	 */
	_addToMain: function(card, mainPos, withAnimation) {
		var _that = this;

		_that._removeCard(card, false);
		_that.cardsMainDeck.elems.splice(mainPos, 0, card.id);
		_that.cardsMainDeck.shownCard = mainPos;

		if (typeof withAnimation != 'undefined' && withAnimation) {
			_that.isAnimate = true;
			_that.canPlay = false;

			card.drag = false;
			card.animated = true;
			card.animationCoords = _that.cardsMainDeck.inverseCoords;
			_that._animateCard(card.id, _that.params.animationSpeed *.8, true);

		} else {
			card.coords = _that.cardsMainDeck.inverseCoords;
		}
	},

	_checkGameEnd: function() {
		var _that = this;

		if(!_that.gameEnd) {
			var endedSuits = 0;

			for (var outputsCounter in _that.cardsOutputs) {
				if(typeof _that.cardsOutputs[outputsCounter].finish != 'undefined' && _that.cardsOutputs[outputsCounter].finish) {
					endedSuits++
				}
			}

			if(endedSuits - _that.params.suits.length == 0) {
				_that.gameEnd = true;
				_that.detachEvents();
				if (typeof _that.params.onEnd == 'function') {
					_that.params.onEnd();
				}
			}
		}
	},

	/**
	 * Проверка: находятся ли координаты в искомой области
	 * @param clickCoords {[]}
	 * @param elemCoords {[]}
	 * @param elemSize {[]}
	 * @returns {boolean}
	 * @private
	 */
	_isEventElem: function(clickCoords, elemCoords, elemSize) {
		var scale = this.params.canvasScale,
			isClicked = false;

		elemCoords = [elemCoords[0]*scale, elemCoords[1]*scale];
		elemSize = [elemSize[0]*scale, elemSize[1]*scale];

		if (clickCoords[0] - elemCoords[0] >= 0 &&
			clickCoords[0] - (elemCoords[0] + elemSize[0]) <= 0 &&
			clickCoords[1] - elemCoords[1] >= 0 &&
			clickCoords[1] - (elemCoords[1] + elemSize[1]) <= 0) {
			isClicked = true
		}
		return isClicked
	},

	/**
	 * Проверка: пересекаются ли прямоугольники
	 * @param elem1 {{}}
	 * @param elem2 {{}}
	 * @returns {boolean}
	 * @private
	 */
	_isCrossed:function(elem1, elem2) {
		var isCross = false;

		if((elem1.coords[0] + elem1.size[0] - elem2.coords[0] >= 0 &&
			elem2.coords[0] + elem2.size[0] - elem1.coords[0] >= 0) &&
			(elem1.coords[1] + elem1.size[1] - elem2.coords[1] >= 0 &&
			elem2.coords[1] + elem2.size[1] - elem1.coords[1] >= 0)) {

			isCross = true;
		}

		return isCross
	},

	/**
	 * Создаем объект, отвечающий за информацию о драгаемых картах
	 * @param mousedownCoords
	 * @param startCoords
	 * @private
	 */
	_createDragObject: function(mousedownCoords, startCoords) {
		var _that = this,
			scale = _that.params.canvasScale;

		_that.dragObject = {};
		_that.dragObject.elems = []; //массив id карт
		_that.dragObject.mousedownCoords = mousedownCoords; //начальные координаты щелчка мыши
		_that.dragObject.startCoords = startCoords; //начальные координаты карты
		_that.dragObject.deltaCoords = [
			mousedownCoords[0]/scale - _that.dragObject.startCoords[0],
			mousedownCoords[1]/scale - _that.dragObject.startCoords[1]
		]; //разница между начальными координатами и положением курсора, чтобы "тянуть" карту визуально за то место, за которое взяли
	},

	/**
	 * Действия по клику на канвас
	 * @param e
	 */
	_clickEvent: function(e) {
		var _that = this;

		if (_that.canPlay) {
			var clickCoords = [
				e.pageX - _that.params.canvasOffset[0],
				e.pageY - _that.params.canvasOffset[1]
			];

			//проверяем куда кликнули
			//на главную колоду слева?
			if (_that._isEventElem(clickCoords, _that.cardsMainDeck.reverseCoords, _that.params.cardSize)) {
				_that._openMainDeck(1);
			}
		}
	},

	/**
	 * Действия по нажатию кнопки мыши
	 * @param e
	 */
	_mousedownEvent: function(e) {
		var _that = this;

		if (_that.canPlay) {
			var mousedownCoords = [
				e.pageX - _that.params.canvasOffset[0],
				e.pageY - _that.params.canvasOffset[1]
			];

			//проверяем куда кликнули:
			//1 - на открытую карту из главной колоды?
			if (_that.cardsMainDeck.shownCard != null && _that._isEventElem(mousedownCoords, _that.cardsMainDeck.inverseCoords, _that.params.cardSize)) {
				_that.isDrag = true;

				_that._createDragObject(mousedownCoords, _that.cards[_that.cardsMainDeck.elems[_that.cardsMainDeck.shownCard]].coords);
				_that.dragObject.elems.push(_that.cardsMainDeck.elems[_that.cardsMainDeck.shownCard]);
				_that.cards[_that.cardsMainDeck.elems[_that.cardsMainDeck.shownCard]].drag = true;

			} else {

				//2 - на сборщики карт?
				for(var outputsCounter in _that.cardsOutputs) {
					if (_that.cardsOutputs[outputsCounter].elems.length) {
						var outputLastCard = _that.cards[_that.cardsOutputs[outputsCounter].elems[_that.cardsOutputs[outputsCounter].elems.length - 1]];
						if (_that._isEventElem(mousedownCoords, outputLastCard.coords, _that.params.cardSize)) {
							_that.isDrag = true;
							_that._createDragObject(mousedownCoords, outputLastCard.coords);
							_that.dragObject.elems.push(outputLastCard.id);
							outputLastCard.drag = true;
							break
						}
					}
				}

				//3 - на открытые карты в стопках снизу?
				if (!_that.isDrag) {
					blocksLoop:
						for (var blocksCounter in _that.cardsBlocks) {
							for (var blockCardsCounter = 0; blockCardsCounter < _that.cardsBlocks[blocksCounter].elems.length; blockCardsCounter++) {
								var blockCard = _that.cards[_that.cardsBlocks[blocksCounter].elems[_that.cardsBlocks[blocksCounter].elems.length - blockCardsCounter - 1]];

								if (typeof blockCard != 'undefined' && blockCard.show) {
									if (_that._isEventElem(mousedownCoords, blockCard.coords, _that.params.cardSize)) {
										_that.isDrag = true;
										_that._createDragObject(mousedownCoords, blockCard.coords);

										//Добавляем ссылки на драгаемые карты в массив
										for(var shownCardsCounter = blockCardsCounter; shownCardsCounter >= 0; shownCardsCounter -- ) {
											var dragCard = _that.cards[_that.cardsBlocks[blocksCounter].elems[_that.cardsBlocks[blocksCounter].elems.length - shownCardsCounter - 1]];
											_that.dragObject.elems.push(dragCard.id);
											dragCard.drag = true;
										}
										_that.dragObject.fromBlock = blocksCounter;

										break blocksLoop
									}

								} else {
									break
								}
							}
						}
				}
			}
		}
	},

	/**
	 * Действия по передвижению кнопки мыши
	 * @param e
	 */
	_mousemoveEvent: function(e) {
		var _that = this;

		if (_that.canPlay) {
			var mousemoveCoords = [
					e.pageX - _that.params.canvasOffset[0],
					e.pageY - _that.params.canvasOffset[1]
				],
				scale = _that.params.canvasScale;

			if (_that.isDrag && _that.dragObject != null) {
				for (var dragCardsCounter = 0; _that.dragObject.elems.length - dragCardsCounter > 0; dragCardsCounter ++ ) {
					_that.cards[_that.dragObject.elems[dragCardsCounter]].coords = [
						mousemoveCoords[0]/scale - _that.dragObject.deltaCoords[0],
						mousemoveCoords[1]/scale - _that.dragObject.deltaCoords[1] + _that.params.blockBigCardSpase * dragCardsCounter
					];
				}

				_that._draw();
			}
		}
	},

	/**
	 * Действия по отпусканию кнопки мыши
	 * @param e
	 */
	_mouseupEvent: function(e) {
		var _that = this;

		if (_that.isDrag && _that.dragObject != null) {
			var firstDragElem = _that.cards[_that.dragObject.elems[0]],
				findArea = false; // флаг, показывающий, нашлась ли область, на которую можно сделать дроп

			//В сборщики можно перетаскивать только по 1 карте
			if(_that.dragObject.elems.length == 1) {
				//Упала ли карта на место для сбора карт по мастям?
				for (var outputsCounter in _that.cardsOutputs) {
					var isOutputCross = _that._isCrossed(
						{coords: firstDragElem.coords, size: _that.params.cardSize},
						{coords: _that.cardsOutputs[outputsCounter].coords, size: _that.params.cardSize}
					);

					if (isOutputCross) {
						if(_that._tryAddToOutput(firstDragElem, outputsCounter)) {
							findArea = true;
							firstDragElem.drag = false;
							_that.prevStep.type = 'add';
							_that.prevStep.elems = [];
							_that._addToOutput(firstDragElem, outputsCounter, true, true);
							break
						}
					}
				}
			}

			//Упала ли карта на стопку внизу?
			if (!findArea) {
				for (var blocksCounter in _that.cardsBlocks) {
					var isCross = _that._isCrossed(
						{coords: firstDragElem.coords, size: _that.params.cardSize},
						{coords: _that.cardsBlocks[blocksCounter].coords, size: [_that.params.cardSize[0], _that.cardsBlocks[blocksCounter].height]}
					);

					if (isCross) {
						if(_that._tryAddToBlock(firstDragElem, blocksCounter)) {
							var addToHistory = true;
							findArea = true;

							_that.prevStep.type = 'add';
							_that.prevStep.elems = [];

							//При драге добавляем карты в историю тут
							//потому что при отмене хода карты должны лежать в обратном порядке
							for (var inverseDragCardsCounter = _that.dragObject.elems.length - 1; inverseDragCardsCounter >= 0; inverseDragCardsCounter-- ) {
								var inverseDragCard = _that.cards[_that.dragObject.elems[inverseDragCardsCounter]];
								if(typeof inverseDragCard.block != 'undefined' && inverseDragCard.block != null) {
									_that.prevStep.elems.push({
										cardId: inverseDragCard.id,
										fromEl: 'block',
										fromPos: inverseDragCard.block
									});
									addToHistory = false;
								} else {
									break
								}
							}

							//Добавляем карты в блок
							for (var dragCardsCounter = 0; _that.dragObject.elems.length - dragCardsCounter > 0; dragCardsCounter ++ ) {
								var dragCard = _that.cards[_that.dragObject.elems[dragCardsCounter]];
								dragCard.drag = false;
								_that._addToBlock(dragCard, blocksCounter, addToHistory, true);
							}

							if (typeof _that.params.afterStep == 'function' && !addToHistory) {
								_that.params.afterStep();
							}

							break
						}
					}
				}
			}

			if (findArea) {
				//Если карта куда-то переехала
				//У колонки, с которой перенесли карту, открываем последнюю карту, если в ней они еще остались
				if (typeof _that.dragObject.fromBlock != 'undefined') {
					_that._setCardsBlockHeight(_that.dragObject.fromBlock);

					if(_that.cardsBlocks[_that.dragObject.fromBlock].elems.length) {
						var toShowId = _that.cardsBlocks[_that.dragObject.fromBlock].elems[_that.cardsBlocks[_that.dragObject.fromBlock].elems.length - 1];

						if(!_that.cards[toShowId].show) {
							_that.cards[toShowId].show = true;
							_that.prevStep.elems.push({
								cardId: toShowId,
								fromEl: 'block',
								fromPos: _that.dragObject.fromBlock
							});
						}
					}
				}

			} else {
				for (var dragCardsBackCounter = 0; _that.dragObject.elems.length - dragCardsBackCounter > 0; dragCardsBackCounter ++ ) {
					var backCard = _that.cards[_that.dragObject.elems[dragCardsBackCounter]],
						isLast = _that.dragObject.elems.length - dragCardsBackCounter == 1 ;

					backCard.drag = false;

					//Карта никуда не переехала и это не двойной клик - возвращаем координаты карт обратно
					if(typeof e != 'undefined') {
						var mouseupCoords = [
							e.pageX - _that.params.canvasOffset[0],
							e.pageY - _that.params.canvasOffset[1]
						];

						if (_that.dragObject.mousedownCoords[0] - mouseupCoords[0] != 0 || _that.dragObject.mousedownCoords[1] - mouseupCoords[1] != 0) {
							_that.isAnimate = true;
							_that.canPlay = false;
							backCard.animated = true;
							backCard.animationCoords = [
								_that.dragObject.startCoords[0],
								_that.dragObject.startCoords[1] + _that.params.blockBigCardSpase * dragCardsBackCounter
							];

							_that._animateCard(backCard.id, _that.params.animationSpeed *.2, isLast);
						}
					}
				}
			}

			_that.isDrag = false;
			_that.dragObject = null;

			_that._draw();
		}
	},

	/**
	 * Действия по выводу мыши из области канваса
	 */
	_mouseleaveEvent: function(e) {
		if (this.canPlay) {
			this._mouseupEvent(e);
		}
	},

	/**
	 * Действия по двойному клику
	 * @param isLoop {boolean} в цикле или нет вызывается функция
	 * @private
	 */
	_dblclickEvent: function(isLoop) {
		var _that = this;

		if (_that.canPlay) {
			var isAdded = false; //есть ли хоть какие-то добавленные карты

			_that.canPlay = false;

			if(_that.cardsMainDeck.shownCard != null) {
				var mainOpenCard = _that.cards[_that.cardsMainDeck.elems[_that.cardsMainDeck.shownCard]];

				//1 - пробуем положить карту из главной колоды в сборщик
				for (var outputsCounter in _that.cardsOutputs) {
					if(_that._tryAddToOutput(mainOpenCard, outputsCounter)) {
						isAdded = true;
						if(typeof isLoop == 'undefined' || !isLoop) {
							_that.prevStep.type = 'add';
							_that.prevStep.elems = [];
						}
						_that._addToOutput(mainOpenCard, outputsCounter, true, true);
						break
					}
				}
			}

			if(!isAdded) {
				//2 - пробуем положить каждую последнюю открытую карту в стопке в сборщик
				blocksLoop:
					for (var blocksCounter in _that.cardsBlocks) {
						if (_that.cardsBlocks[blocksCounter].elems.length) {
							var lastOpenBlockCard = _that.cards[_that.cardsBlocks[blocksCounter].elems[_that.cardsBlocks[blocksCounter].elems.length - 1]];

							for (var outputsCounter2 in _that.cardsOutputs) {
								if(_that._tryAddToOutput(lastOpenBlockCard, outputsCounter2)) {
									isAdded = true;
									if(typeof isLoop == 'undefined' || !isLoop) {
										_that.prevStep.type = 'add';
										_that.prevStep.elems = [];
									}
									_that._addToOutput(lastOpenBlockCard, outputsCounter2, true, true);

									if (_that.cardsBlocks[blocksCounter].elems.length) {
										var toShowId = _that.cardsBlocks[blocksCounter].elems[_that.cardsBlocks[blocksCounter].elems.length - 1];
										if(!_that.cards[toShowId].show) {
											_that.cards[toShowId].show = true;
											_that.prevStep.elems.push({
												cardId: toShowId,
												fromEl: 'block',
												fromPos: blocksCounter
											});
										}
									}
									break blocksLoop
								}
							}
						}
					}
			}


			if (isAdded) {
				_that._draw();
				setTimeout(function() {
					_that._dblclickEvent(true);
				}, _that.params.animationSpeed *.8);
			} else {
				_that.canPlay = true;
			}
		}
	},

	/**
	 * Действия по ресайзу окна браузера
	 */
	_resizeEvent: function() {
		var _that = this;

		if (_that.resizeTimer) {
			clearTimeout(_that.resizeTimer);
		}

		_that.resizeTimer = setTimeout(function() {
			var canvasParent = _that.elem.parentElement,
				newWidth = canvasParent.offsetWidth,
				newScale = 1;

			if (_that.params.canvasMaxWidth && _that.params.canvasMaxWidth - newWidth < 0) {
				newWidth = _that.params.canvasMaxWidth;
			}

			newScale = (newWidth / _that.params.canvasSize[0]).toFixed(2);

			_that.elem.width = newWidth;
			_that.elem.height = _that.params.canvasSize[1]*newScale;
			_that.params.canvasOffset = _that._getOffset();

			_that.params.canvasScale = newScale;
			_that._draw();
		}, 300);
	},

	/**
	 * Все события
	 */
	attachEvents: function() {
		var _that = this;

		_that._clickEventListener = function(e){
			e.preventDefault();
			_that._clickEvent.call(_that, e);
		};
		_that._mousemoveEventListener = function(e){
			_that._mousemoveEvent.call(_that, e);
		};
		_that._mousedownEventListener = function(e) {
			e.preventDefault();
			_that._mousedownEvent.call(_that, e);
			_that.elem.addEventListener('mousemove', _that._mousemoveEventListener, false);
		};
		_that._mouseupEventListener = function(e){
			_that._mouseupEvent.call(_that, e);
			_that.elem.removeEventListener('mousemove', _that._mousemoveEventListener, false);
		};
		_that._mouseleaveEventListener = function(e){
			_that._mouseleaveEvent.call(_that, e);
			_that.elem.removeEventListener('mousemove', _that._mousemoveEventListener, false);
		};
		_that._dblclickEventListener = function(e){
			e.preventDefault();
			_that._dblclickEvent.call(_that);
		};
		_that._resizeEventListener = function(){
			_that._resizeEvent.call(_that);
		};

		_that.elem.addEventListener('click', _that._clickEventListener, false);
		_that.elem.addEventListener('mousedown', _that._mousedownEventListener, false);
		_that.elem.addEventListener('mouseup', _that._mouseupEventListener, false);
		_that.elem.addEventListener('mouseleave', _that._mouseleaveEventListener, false);
		_that.elem.addEventListener('dblclick', _that._dblclickEventListener, false);

		window.addEventListener('resize', _that._resizeEventListener, false)
	},

	/**
	 * Перестаем отлавливать события
	 */
	detachEvents: function() {
		var _that = this;

		_that.elem.removeEventListener('click', _that._clickEventListener, false);
		_that.elem.removeEventListener('mousedown', _that._mousedownEventListener, false);
		_that.elem.removeEventListener('mousemove', _that._mousemoveEventListener, false);
		_that.elem.removeEventListener('mouseup', _that._mouseupEventListener, false);
		_that.elem.removeEventListener('mouseleave', _that._mouseleaveEventListener, false);
		_that.elem.removeEventListener('dblclick', _that._dblclickEventListener, false);
		window.removeEventListener('resize', _that._resizeEventListener, false);
	},

	/**
	 * Начать заново текущий расклад
	 */
	againGame: function() {
		if (!(this.isAnimate && this.isDrag)) {
			this.detachEvents();

			this.canPlay = false;
			this.gameEnd = false;
			this.prevStep = {
				type: null,
				elems: []
			};
			this.dragObject = null;

			for (var cardsIterator = 0; this.cards.length - cardsIterator > 0; cardsIterator++) {
				var card = this.cards[cardsIterator];
				card.show = false;
				this._removeCard(card, false);
			}

			this.cardsBlocks = this._createCardsBlocks();
			this.cardsMainDeck = this._createcardsMainDeck();
			this.cardsOutputs = this._createCardsOutputs();

			this._resizeEvent();
			this._firstAnimation();
			this.attachEvents();
		}
	},

	/**
	 * Новый расклад
	 */
	newGame: function() {
		if (!(this.isAnimate && this.isDrag)) {
			this.detachEvents();
			this.init();
			this._resizeEvent();
			this._firstAnimation();
			this.attachEvents();
		}
	},

	/**
	 * Отмена последнего хода
	 */
	cancel: function() {
		if(this.canPlay && typeof this.prevStep.type != null) {

			//Было действие:
			//-- переворачивание колоды
			if(this.prevStep.type == 'open') {
				this._openMainDeck(-1);

				//-- добавление карты
			} else if(this.prevStep.type == 'add') {
				for(var cardIdIterator = this.prevStep.elems.length - 1; cardIdIterator >= 0; cardIdIterator--) {
					var cardObj = this.prevStep.elems[cardIdIterator],
						card = this.cards[cardObj.cardId],
						isLast = cardIdIterator == 0;

					if(cardObj.fromEl == 'main') {
						this._addToMain(card, cardObj.fromPos, true);
					} else if(cardObj.fromEl == 'block') {
						if (cardObj.fromPos == card.block) {
							card.show = false;
						} else {
							this._addToBlock(card, cardObj.fromPos, false, isLast, true);
						}

					} else if(cardObj.fromEl == 'output') {
						this._addToOutput(card, cardObj.fromPos, false, true);
					}
				}
			}

			this.prevStep = {
				type: null,
				elems: []
			};

			if (typeof this.params.afterCancel == 'function') {
				this.params.afterCancel();
			}

			this._draw();
		}
	}
};

(function() {
	var solitaireCanvas = document.getElementById('solitaire');

	if (solitaireCanvas != null) {
		var solitaire = new Solitaire('solitaire', {
			canvasMaxWidth: 1000,
			cardSize: [82, 117],
			cardIndent: [18, 24],
			startPosition: [45, 30],
			imgSrc: '/img/',
			backImg: 'back.png',
			afterLoad: function() {

			},
			afterStep: function() {

			},
			afterCancel: function() {

			},
			onEnd: function() {

			}
		});
	}
})();
