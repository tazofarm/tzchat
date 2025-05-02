// 기본
var express = require("express");
var ejs = require("ejs");

const controller = require('./router/controller1');

const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const path = require('path');

const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
app.use(cors());

// 가져오기
const users = require('./models/User'); // User.js 파일에서 사용자 정보 가져오기

// ejs
app.engine("ejs", ejs.renderFile);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // 수정된 부분

// 기본
app.use(express.static(path.join(__dirname, "public"))); // 수정된 부분
app.use(bodyParser.json()); // JSON 요청 본문을 파싱하기 위한 미들웨어 추가

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/tzchat', {})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// 세션 미들웨어 설정
app.use(session({
    secret: 'tztz', // 세션 암호화 키
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS를 사용할 경우 true로 설정
}));

app.use(express.urlencoded({ extended: true })); // URL 인코딩된 데이터 파싱

// 라우터 사용
app.use('/', controller); // controller1 모듈을 루트 경로에 연결

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 사용자 정보를 EJS로 보여주는 라우트
app.get('/DB/users', (req, res) => {
    res.render('users', { users }); // users.ejs 파일에 사용자 정보 전달
});

// 서버 시작
const PORT = process.env.PORT || 2000;
var server = app.listen(PORT, function () {
    console.log(`서버가 ${PORT} 포트에서 가동 중입니다.`);
});
