const express = require("express");
const router = express.Router();
const { identifyContact } = require("../controllers/contactController.js");

router.post("/identify", identifyContact);

module.exports = router;


