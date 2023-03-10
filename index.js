const express = require("express");
const cors = require("cors");
const app = express();
const mongodb = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
var nodemailer = require("nodemailer");
var randomstring = require("randomstring");
const dotenv = require("dotenv").config();
const mongoClient = mongodb.MongoClient;
const URL = process.env.DB_URL;
const DB = process.env.DB;

//middleware
app.use(express.json());
app.use(
  cors({
    origin: "https://frontend-deploy.netlify.app",
  })
);

let authenticate = (req, res, next) => {
  console.log(req.headers);
  if (req.headers.authorization) {
    try {
      let decode = jwt.verify(req.headers.authorization, process.env.SECRET);
      if (decode) {
        next();
      }
    } catch (error) {
      res.status(401).json({ message: "Unauthorized" });
    }
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};
app.get("/",async function(req,res){
res.send("<h1>Welcome....</h1>")
console.log("welcome")
})

app.post("/data",  async  (req, res) => {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db(DB);
    let data = await db.collection("data").insertOne(req.body);
    await connection.close();
    res.json(data);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "something went wrong" });
  }
});

app.get("/data",authenticate,  async function (req, res) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db(DB);
    let data = await db.collection("data").find().toArray();
    await connection.close();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "something went wrong" });
  }
});
app.post("/register", async function (req, res) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db(DB);

    let salt = await bcrypt.genSalt(10);
    let hash = await bcrypt.hash(req.body.password, salt);

    req.body.password = hash;
    await db.collection("register").insertOne(req.body);

    await connection.close();

    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "something went wrong" });
  }
});

app.post("/login", async function (req, res) {
  try {
    let connection = await mongoClient.connect(URL);
    let db = connection.db(DB);

    let user = await db
      .collection("register")
      .findOne({ name: req.body.name });
    if (user) {
      let compare = await bcrypt.compare(req.body.password, user.password);

      if (compare) {
        let token = jwt.sign({ _id: user._id }, process.env.SECRET, {
          expiresIn: "24h",
        });
        res.json({ token,user });
      } else {
        res.json({ message: "email or Password is wrong" });
      }
    } else {
      res.status(401).json({ message: "User email or password wrong" });
    }
  } catch (error) {
    res.status(500).json({ message: "something went wrong" });
  }
});







app.post("/resetpassword", async function (req, res) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db(DB);
    const user = await db
      .collection("register")
      .findOne({ email: req.body.email });
    if (user) {
      let mailid = req.body.email;
      let rString = randomstring.generate(7);
      let link = "http://localhost:3000/reset-password-page";
      await db
        .collection("register")
        .updateOne({ email: mailid }, { $set: { rString: rString } });
      await connection.close();

      var transporter = nodemailer.createTransport({
        service: "gmail",
       
        auth: {
          user: process.env.gmail,
          pass: process.env.pass,
        },
      });

      var mailOptions = {
        from: process.env.gmail,
        to: mailid,
        subject: "Password Reset",
        text: `Your OTP is ${rString}. Click the link to reset password ${link}`,
        html: `<h2> Your OTP is ${rString}. Click the link to reset password ${link}</h2>`,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
          res.json({
            message: "Email not send",
          });
        } else {
          console.log("Email sent: " + info.response);
          res.json({
            message: "Email Send",
          });
        }
      });
      res.json({
        message: "Email Send",
      });
    } else {
      res.json({
        message: "Email Id not match / User not found",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/reset-password-page", async function (req, res) {
  let mailid = req.body.email;
  let String = req.body.rString;
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db(DB);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);
    req.body.password = hash;
    const user = await db
      .collection("register")
      .findOne({ email: req.body.email });
    if (user) {
      if (user.rString === req.body.rString) {
        await db
          .collection("register")
          .updateOne(
            { rString: String },
            { $set: { password: req.body.password } }
          );
        res.json({
          message: "Password reset done",
        });
      } else {
        res.json({
          message: "Random String is incorrect",
        });
      }
    } else {
      res.json({
        message: "Email Id not match / User not found",
      });
    }
    await db
      .collection("register")
      .updateOne({ rString: String }, { $unset: { rString: "" } });
  } catch (error) {
    console.log(error);
  }
});
app.listen(process.env.PORT || 7000);
