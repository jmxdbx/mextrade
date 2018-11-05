

/* eslint-env node*/

const fs = require('fs');
const EMA = require('technicalindicators').EMA;
const SMA = require('technicalindicators').SMA;
const Highest = require('technicalindicators').Highest;
const Lowest = require('technicalindicators').Lowest;

// Margin multiplier, use 1.5 for 1.5x, etc. Set up to replicate trading BTCUSD even though XBT is inverse swap with BTC held as collateral.
//  Don't use marginMult 1, because a longMult of 0 would attempt orders of 0 quantity. Strat does not use dynamic position sizing currently, and is always in position.
const marginMult = 1.25;
const shortMult = marginMult + 1;
const longMult =  marginMult - 1;

const takePer = 1.23;
const bodyLen = 10;
const lenPer = 20;
const bars = 1;

// Frontrun candle by specified ms. This is just a hunch.
const front = 60100;

const tp = 0.065;

var offset = 0;

const whichBfxPair = 'BTCUSD';
const MexTrade = require('./MexTrade');

var mex = new MexTrade();
var pair = {};

var dist = 0;
var distSMA = 0;
var hd = 0;
var ld = 0;
var hd2 = 0;
var ld2 = 0;
var upTrend = 0;
var dnTrend = 0;
var center = 0;
var trend = 0;
var prevTrend = 0;
var bar = 0;
var prevBar = 0;
var body = 0;
var smaBody = 0;
var sma = new SMA({ values :[], period : 21});
var ema = new EMA({period : 30, values :[]});
var highest = new Highest({values:[], period: lenPer});
var lowest = new Lowest({values:[], period: lenPer});
var lastHigh = 0;
var lastLow = 0;

var prevClose = 0;

var chd = [];
var cld = [];
var chdTemp;
var cldTemp;

var roundHalf = function(n) {
    return (Math.floor(n*2)/2).toFixed(1);
};

function rou(num, dec) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}


function Manager(){
  pair={
    open:0,
    close:0,
    high:0,
    low:0,
    up7:0,
    dn7:0,
    up8:0,
    dn8:0,
    longCondition:0,
    shortCondition:0,
    long: false,
    short: false,
    stopLossPrice:0,
    takeProfitPrice:0,
    entryPrice: NaN,
    XBTPositionSize:0,
    BTCBalance:0,
    pivotAmount:0,
    timeStamp:0,
  }
}


/**
  Start bot
**/
Manager.prototype.runBot = function(){

  var i = 0;
  while (i < bars){
  chd.push(false)
  cld.push(false)
  i++
  }

  console.log("Initializing bot");

  mex.getPrices();

  mex.getPosition(function(base, amount){

    mex.getBalance(function(balance){
      if (balance){
        pair['BTCBalance'] =balance;
        if (amount){
          base = parseFloat(base, 10);
          amount = parseFloat(amount, 10);
          if (amount > 0){
            pair['long'] = true;
            pair['XBTPositionSize'] = amount;
            pair['entryPrice'] = base;
            pair['stopLossPrice'] = Math.ceil(base * 0.7);
            pair['takeProfitPrice'] = Math.ceil(base * (1+tp));
            console.log(pair)
          }else if (amount < 0){
            amount = Math.abs(amount);
            if (amount > (1.25 * base * balance)){
              pair['short'] = true;
              pair['XBTPositionSize'] = amount;
              pair['entryPrice'] = base;
              pair['stopLossPrice'] = Math.floor(base * 1.3);
              pair['takeProfitPrice'] = Math.floor(base * (1-tp));
              console.log(pair)
            }else{
              pair['long'] = false;
              pair['short'] = false;
              pair['XBTPositionSize'] = amount;
              pair['entryPrice'] = NaN;
              pair['stopLossPrice'] = 0;
              pair['takeProfitPrice'] = 0;
              console.log(pair)
            }
          }else{
            console.log("Debug Error, getPosition thinks there is a position but amount = 0 or nan");
          }
        }
      }else{
        console.log('Error Getting Balance')
      }

    })
  });
  mex.getHistBucket(function(data){
    console.log("Fetching Historical Data");

    data.reverse()
    //console.log(data)

    for(var bucket of data){
      //do something TRADE LOGIC OMITTED
    }


    // setTimeout(function(){
    //   var orderID = "d7f99df3-8a16-1793-bf0b-dbcde1ebccf1";
    //   mex.getOrders(orderID, function(status){
    //     console.log(status)
    //
    //
    //   })
    //
    // }, 3000);

    setTimeout(function() {
      mex.cancelAll(function(success){
        if(success){
          console.log("Manager Debug All Canceled")
        }else{
          console.log("Manager Debug Error Canceling Orders")
        }
      })
      console.log

      pair['longCondition'] = true;
      //pair['shortCondition'] = true;
      findTradeOpportunity();
    }, 5000);



})
//

  setInterval(function(){
    mex.getPosition(function(base, amount){

      mex.getBalance(function(balance){
        if (balance){
          pair['BTCBalance'] =balance;
          if (amount){
            base = parseFloat(base, 10);
            amount = parseFloat(amount, 10);
            if (amount > 0){
              pair['long'] = true;
              pair['short'] = false;
              pair['XBTPositionSize'] = amount;
              pair['entryPrice'] = base;
              pair['stopLossPrice'] = Math.ceil(base * 0.7);
              pair['takeProfitPrice'] = Math.ceil(base * (1+tp));
            }else if (amount < 0){
              amount = Math.abs(amount);
              if (amount > (1.25 * base * balance)){
                pair['short'] = true;
                pair['long'] = false;
                pair['XBTPositionSize'] = amount;
                pair['entryPrice'] = base;
                pair['stopLossPrice'] = Math.floor(base * 1.3);
                pair['takeProfitPrice'] = Math.floor(base * (1-tp));
              }else{
                pair['long'] = false;
                pair['short'] = false;
                pair['XBTPositionSize'] = amount;
                pair['entryPrice'] = NaN;
                pair['stopLossPrice'] = 0;
                pair['takeProfitPrice'] = 0;
              }
            }else{
              console.log("Debug Error, getPosition thinks there is a position but amount = 0 or nan");
            }

            // If condition but not in position, cancel all orders and re-place
            // if(!pair['long'] && pair['longCondition']){
            //   console.log("Retry Long, order not filled")
            //   mex.cancelAll(function(success){
            //     if(success){
            //       if(pair['short']){
            //         closeShortPosition('closeShortPivot');
            //       }else{
            //         openLongPosition('openLong');
            //       }
            //     }else{
            //       console.log("Manager Debug Error Canceling Orders")
            //     }
            //   })
            //
            // }else if(!pair['short'] && pair['shortCondition']){
            //   console.log("Retry Short, order not filled")
            //   mex.cancelAll(function(success){
            //     if (success){
            //       if(pair['long']){
            //         // close long and go short
            //           closeLongPosition('closeLongPivot');
            //         }else{
            //           openShortPosition('openShort');
            //         }
            //     }else{
            //       console.log("Manager Debug Error Canceling Orders")
            //     }
            //   })
            // }
          }
        }else{
          console.log('Error Getting Balance')
        }

      })
    });
  }, 180000)

  var delay = (3600000 - Date.now()% 3600000) - front;
  console.log("Trading starts in ",delay/60000," minutes");
  //console.log(pair);

  setTimeout(function(){

    console.log("Start Running Bot on Current Data");
    updateIndicators(mex.prices);
    setInterval(function(){
      console.log("Refresh Price Data, New Candle");
      updateIndicators(mex.prices);
    }, 3600000)
  }, delay);
}

function updateIndicators(price){
  var closeTemp = 0;
  mex.getLastCandle(whichBfxPair, function(resppair, data){
    for(var candle of data){
      if (mex.prices["lastPrice"]){
        closeTemp = mex.prices["lastPrice"]
      }else{
        closeTemp = candle[2]
      }
      mex.getBucket(function(highBucket, lowBucket, openBucket, timestampBucket){
        if(highBucket){
          pair['high'] = highBucket;
          pair['low'] = lowBucket;
          pair['open'] = openBucket;
        }else{
          console.log("Error Manager Debug getting Bucket");
          pair['high'] = candle[3]
          pair['low'] = candle[4]
          pair['open'] = prevClose;
        }

        //closeTemp = candle[2]
        //closeTemp = mex.prices["lastPrice"]
        pair['close'] = closeTemp;

        //do something - TRADE LOGIC OMITTED

        // if (pair['longCondition']){
        //   if ((mex.prices["bid"] - candle[2]) > (0.0005 * mex.prices["bid"])){
        //     offset = Math.abs(roundHalf((mex.prices["bid"] - candle[2]) - (0.0005*mex.prices["bid"])))
        //     console.log("Offset by ", offset)
        //     offset = 0;
        //   }else{
        //     offset = 0;
        //   }
        // }else if (pair['shortCondition']){
        //   if ((candle[2] - mex.prices["ask"]) > (0.0005 * mex.prices["ask"])){
        //     offset = Math.abs(roundHalf((candle[2] - mex.prices["ask"]) - (0.0005*mex.prices["ask"])))
        //     console.log("Offset by ", offset)
        //     offset = 0;
        //   }else{
        //     offset = 0;
        //   }
        // }

        prevClose = pair['close'];



        findTradeOpportunity();
        prevBar = bar;
        prevTrend = trend;
        pair['timeStamp'] = timestampBucket;
        console.log("Current Pair Updated", pair);
      })

    }

  });

}

function findTradeOpportunity(){


  mex.getPosition(function(base, amount){

    mex.getBalance(function(balance){
      if (balance){
        pair['BTCBalance'] =balance;
        if (amount){
          base = parseFloat(base, 10);
          amount = parseFloat(amount, 10);
          if (amount > 0){
            pair['long'] = true;
            pair['short'] = false;
            pair['XBTPositionSize'] = amount;
            pair['entryPrice'] = base;
            pair['stopLossPrice'] = Math.ceil(base * 0.7);
            pair['takeProfitPrice'] = Math.ceil(base * (1+tp));
          }else if (amount < 0){
            amount = Math.abs(amount);
            if (amount > (1.25 * base * balance)){
              pair['short'] = true;
              pair['long'] = false;
              pair['XBTPositionSize'] = amount;
              pair['entryPrice'] = base;
              pair['stopLossPrice'] = Math.floor(base * 1.3);
              pair['takeProfitPrice'] = Math.floor(base * (1-tp));
            }else{
              pair['long'] = false;
              pair['short'] = false;
              pair['XBTPositionSize'] = amount;
              pair['entryPrice'] = NaN;
              pair['stopLossPrice'] = 0;
              pair['takeProfitPrice'] = 0;
            }
          }else{
            console.log("Debug Error, getPosition thinks there is a position but amount = 0 or nan");
          }

          pair['BTCBalance'] =balance;
          if(!pair['long'] && pair['longCondition']){
            mex.cancelAll(function(success){
              if(success){
                if(pair['short']){
                  closeShortPosition('closeShortPivot');
                }else{
                  openLongPosition('openLong');
                }
              }else{
                console.log("Manager Debug Error Canceling Orders")
              }
            })

          }else if(!pair['short'] && pair['shortCondition']){
            mex.cancelAll(function(success){
              if (success){
                if(pair['long']){
                  // close long and go short
                    closeLongPosition('closeLongPivot');
                  }else{
                    openShortPosition('openShort');
                  }
              }else{
                console.log("Manager Debug Error Canceling Orders")
              }
            })

          }else{
            // console.log("Flat")
          }

        }
      }else{
        console.log('Error Getting Balance')
      }

    })
  });
}

function openLongPosition(action){
    var attemptPrice = mex.prices["bid"] - offset;
    var afterPivot = 0;
    var attemptXBTAmount = Math.ceil(pair['BTCBalance'] * attemptPrice * longMult) + pair['XBTPositionSize'];
    afterPivot = attemptXBTAmount - pair['XBTPositionSize'];
    mex.trade(attemptXBTAmount, attemptPrice, action, 'Buy', pair['BTCBalance'], afterPivot, function(success){
      if(success){
        pair['long'] = true;
        pair['XBTPositionSize'] = attemptXBTAmount;
        pair['entryPrice'] = attemptPrice;
        pair['stopLossPrice'] = Math.ceil(attemptPrice * 0.7);
        pair['takeProfitPrice'] = Math.ceil(attemptPrice * (1+tp));
        console.log('Submitted long order worth ', attemptXBTAmount, ' at price', attemptPrice);
        console.log('---------------------------------------------------------');
      }else{
        console.log('Trade was not successful at attempt price ', attemptPrice);
      }
    });
}

function openShortPosition(action){
    var attemptPrice = mex.prices["ask"] + offset;
    var afterPivot = 0;
    var attemptXBTAmount = Math.ceil(pair['BTCBalance'] * attemptPrice * shortMult) - pair['XBTPositionSize'];
    afterPivot = pair['XBTPositionSize'] + attemptXBTAmount;
    mex.trade(attemptXBTAmount, attemptPrice, action, 'Sell', pair['BTCBalance'], afterPivot, function(success){
      if (success){
        pair['short'] = true;
        pair['XBTPositionSize'] = attemptXBTAmount;
        pair['entryPrice'] = attemptPrice;
        pair['stopLossPrice'] = Math.floor(attemptPrice * 1.3);
        pair['takeProfitPrice'] = Math.floor(attemptPrice * (1-tp));
        console.log('Submitted short order worth ', attemptXBTAmount, ' at price ', attemptPrice);
        console.log('---------------------------------------------------------');
      } else{
        console.log('Trade was not successful');
    };
  });
}

function closeLongPosition(action){
  var attemptPrice = mex.prices["ask"] + offset;
  var newBTCAmount = 0;
  var afterPivot = 0;
  if (action = "closeLongPivot"){
    newBTCAmount = pair['BTCBalance'] + (pair["XBTPositionSize"] * (1/pair['entryPrice'] - 1/attemptPrice))
    pair["pivotAmount"] = Math.ceil(newBTCAmount * attemptPrice * shortMult) + pair['XBTPositionSize'];
    afterPivot = pair["pivotAmount"] - pair['XBTPositionSize'];
    mex.trade(pair["pivotAmount"], attemptPrice, action, 'Sell', newBTCAmount, afterPivot, function(success){
      if (success){
        pair['long'] = false;
        pair['short'] = true;
        pair['XBTPositionSize'] = pair["pivotAmount"] - pair['XBTPositionSize'];
        pair['entryPrice'] = attemptPrice;
        pair['stopLossPrice'] = Math.floor(attemptPrice * 1.3);
        pair['takeProfitPrice'] = Math.floor(attemptPrice * (1-tp));
        console.log('Closed long position at price', attemptPrice)
        console.log('---------------------------------------------------------');
      }else{
        console.log('Attempt favorable price trade was not successful');
      }
    });
  }else if (action = "closeLong"){
    newBTCAmount = pair['BTCBalance'] + (pair["XBTPositionSize"] * (1/pair['entryPrice'] - 1/attemptPrice))
    pair["pivotAmount"] = Math.ceil(newBTCAmount * attemptPrice) + pair['XBTPositionSize'];
    mex.trade(pair["pivotAmount"], attemptPrice, action, 'Sell', newBTCAmount, afterPivot, function(success){
      if (success){
        pair['XBTPositionSize'] =  pair["pivotAmount"];
        pair['entryPrice'] = attemptPrice;
        pair['long'] = false;
        pair['short'] = false;
        console.log('Closed long position at ', attemptPrice)
        console.log('---------------------------------------------------------');
      }else{
        console.log('Trade was not successful');
      }
    });

  }
}

function closeShortPosition(action){
  var attemptPrice = mex.prices["bid"] - offset;
  var newBTCAmount = 0;
  var afterPivot = 0;
  if (action = "closeShortPivot"){
    newBTCAmount = pair['BTCBalance'] + (pair["XBTPositionSize"] * (1/attemptPrice - 1/pair['entryPrice']))
    pair["pivotAmount"] = Math.ceil(newBTCAmount * attemptPrice * longMult) + pair['XBTPositionSize'];
    afterPivot = pair["pivotAmount"] - pair['XBTPositionSize'];
    mex.trade(pair["pivotAmount"], attemptPrice, action, 'Buy', newBTCAmount, afterPivot, function(success){
      if (success){
          pair['long'] = true;
          pair['short'] = false;
          pair['XBTPositionSize'] = pair["pivotAmount"] - pair['XBTPositionSize'];
          pair['entryPrice'] = attemptPrice;
          pair['stopLossPrice'] = Math.ceil(attemptPrice * 0.7);
          pair['takeProfitPrice'] = Math.ceil(attemptPrice * (1+tp));
        console.log('Closed short and Pivot Long at price ', attemptPrice)
        console.log('---------------------------------------------------------');
      }else{
        console.log('Trade was not successful');
      }
    });
  }else if (action == "closeShort"){
    newBTCAmount = pair['BTCBalance'] + (pair["XBTPositionSize"] * (1/attemptPrice - 1/pair['entryPrice']))
    pair["pivotAmount"] = pair['XBTPositionSize'] - Math.ceil(newBTCAmount * attemptPrice);
    mex.trade(pair["pivotAmount"], attemptPrice, action, 'Buy', newBTCAmount, afterPivot, function(success){
      if (success){
        pair['XBTPositionSize'] = pair["pivotAmount"];
        pair['entryPrice'] = attemptPrice;
        pair['long'] = false;
        pair['short'] = false;
        console.log('Closed short position at price ', attemptPrice)
        console.log('---------------------------------------------------------');
      }else{
        console.log('Trade was not successful');
      }
    });
  }
}

module.exports = Manager;
