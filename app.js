const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cron = require("node-cron");
const axios = require("axios");
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const app = express();

const HeyChatAPPToken =
  "NzgwMTI0Nzg7MTczNjk1MDU5NDE0MjQ3Mzk4NDs1MTIwNTAwMTUwNTM0NTYwNzQ=";
const WSS_URL = "wss://chat.xiaoheihe.cn/chatroom/ws/connect?";
const COMMON_PARAMS =
  "chat_os_type=bot&client_type=heybox_chat&chat_version=999.0.0&chat_version=1.24.5";
const TOKEN_PARAMS = "&token=";
const HTTP_HOST = "https://chat.xiaoheihe.cn";
const SEND_MSG_URL = "/chatroom/v2/channel_msg/send?";

const objectChannelId = "3615503813472190470";
const roomId = "3615503813451923456";

let consumerId = 0;

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/refreshWeatherdata", async (req, res, next) => {
  let weatherInfo = await getWeather(330100, 320100, 330400);
  res.send(weatherInfo);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

//每晚7点执行
cron.schedule("0 17,18,19,20,21,22,23,0,1 * * *", () => {
  getWeather(330100, 320100, 330400);
});

async function getWeather(...args) {
  const requests = [];
  args.forEach((cityCode) => {
    let url =
      "https://restapi.amap.com/v3/weather/weatherInfo?parameters&key=e9adcdcca3bd78d9e1862c466499f02c&city=" +
      cityCode;
    // console.log("url:" + url);
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: url,
      headers: {},
    };
    requests.push(axios.request(config));
  });
  let weatherInfo = today();
  const responses = await Promise.all(requests);
  await sendWeather(weatherInfo);
  responses.forEach((response, index) => {
    let data = response.data.lives[0];
    weatherInfo = extractWeatherInfo(data);
    sendWeather(weatherInfo);
  });
  consumerId = 0;
  return "success";
}

async function sendWeather(weatherInfo) {
  let data = `{
    "msg": "${weatherInfo}",
    "msg_type": 10,
    "heychat_ack_id": "${consumerId++}",
    "reply_id": "",
    "room_id": "${roomId}",
    "addition": "{}",
    "at_user_id": "",
    "at_role_id": "",
    "mention_channel_id": "",
    "channel_id": "${objectChannelId}",
    "channel_type": 1
}`;
  let config = {
    method: "post",
    url: "https://chat.xiaoheihe.cn/chatroom/v2/channel_msg/send?client_type=heybox_chat&x_client_type=web&os_type=web&x_os_type=bot&x_app=heybox_chat&chat_os_type=bot&chat_version=1.30.0",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      token: HeyChatAPPToken,
    },
    data: data,
  };

  console.log(config);

  await axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });
}
function today() {
  const date = new Date(/*data.reporttime*/);
  const formattedDate = `${date.getFullYear()}年${
    date.getMonth() + 1
  }月${date.getDate()}日 ${date.getHours()}点${date.getMinutes()}分：`;
  return formattedDate;
}
function extractWeatherInfo(data) {
  return `${data.city}：${data.weather}，气温：${data.temperature}摄氏度，风向：${data.winddirection}，风力${data.windpower}，空气湿度为：${data.humidity}%。`;
}
/*今天是${formattedDate}，*/
module.exports = app;
