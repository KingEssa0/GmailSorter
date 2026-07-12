const express = require("express");
const Category = require("../models/Category");
const Email = require("../models/Email");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.user._id });

    // attach live email count to each category
    const result = await Promise.all(
      categories.map(async (cat) => {
        const count = await Email.countDocuments({ categoryId: cat._id, userId: req.user._id });
        return { ...cat.toObject(), emailCount: count };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim()) return res.status(400).json({ msg: "Category name is required" });
    if (!description?.trim()) return res.status(400).json({ msg: "Category description is required" });

    const category = new Category({
      userId: req.user._id,
      name: name.trim(),
      description: description.trim(),
    });

    await category.save();
    res.json(category);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, userId: req.user._id });
    if (!category) return res.status(404).json({ msg: "Category not found" });

    await Email.deleteMany({ categoryId: category._id, userId: req.user._id });
    await Category.findByIdAndDelete(category._id);

    res.json({ msg: "Category deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
