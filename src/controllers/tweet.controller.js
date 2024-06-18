import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet

  // get tweet content from req.body
  const { content } = req.body;

  // check if user is authenticated
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // check if content is provided
  if (!content || content.trim() === "") {
    throw new ApiError(400, "tweet content is required");
  }

  // create tweet
  const tweet = await Tweet.create({
    owner: req.user?._id,
    content,
  });
  // check if tweet is created
  if (!tweet) {
    throw new ApiError(500, "Something Went Wrong While creating tweet");
  }

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet added Successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  // get user id from req.params
  const { userId } = req.params;

  // get page and limit from req.query
  const { page = 1, limit = 10 } = req.query;

  // check if userId is valid objectId
  if (!isValidObjectId(userId)) {
    throw new ApiError(404, "Invalid User Id");
  }

  // find and authenticate user by req.user?._id
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  // Create a tweets Aggregation pipeline
  const tweetsAggregation = Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              email: 1,
              username: 1,
              fullname: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  // aggregatePaginate options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    customLabels: {
      totalDocs: "TweetCount",
      docs: "Tweets",
    },
  };

  // Tweet.aggregatePaginate for pagination
  const tweetResult = await Tweet.aggregatePaginate(tweetsAggregation, options);
  if (!tweetResult) {
    throw new ApiError(
      500,
      "some Internal error Occured while fetching Tweets"
    );
  }

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, tweetResult, "Tweets Fetched Sucessfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet

  // get tweetId from req.params
  const { tweetId } = req.params;
  // get tweet content from req.body
  const { content } = req.body;

  // if tweetId is valid objectId
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(404, "Invalid TweetId");
  }

  // check if content is provided and is not empty
  if (content?.trim() === "") {
    throw new ApiError(400, "Tweet Content is Required");
  }

  // check if tweet exists in collection
  const tweet = await Tweet.findById(tweetId, { owner: 1 });
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // authenticate if user exists
  const user = await User.findById(req.user?._id, { _id: 1 });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // validate if the user is owner of this tweet
  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized To perform this action");
  }

  // find and update tweet
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    { content },
    { new: true }
  );
  if (!updateTweet) {
    throw new ApiError(500, "some internal error occured while updating Tweet");
  }

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet Updated Successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet

  // get tweetId from req.params
  const { tweetId } = req.params;

  // if tweetId is valid objectId
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(404, "Invalid TweetId");
  }

  // check if tweet exists in collection
  const tweet = await Tweet.findById(tweetId, { owner: 1 });
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // authenticate if user exists
  const user = await User.findById(req.user?._id, { _id: 1 });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // validate if the user is owner of this tweet
  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized To perform this action");
  }

  // find and delete tweet
  const deleteTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deleteTweet) {
    throw new ApiError(500, "some internal error occured while Deleting Tweet");
  }

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, [], "Tweet Deleted Successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
