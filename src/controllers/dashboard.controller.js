import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

  // get user from req.user?._id
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // get channel stats
  const channelStatus = await User.aggregate([
    {
      // Match stage: Filters the documents to only include the user with the logged-in user's ID
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      // Lookup stage: Joins the 'videos' collection with the 'users' collection
      // Finds all videos where the 'owner' field matches the user's '_id'
      // Stores the results in the 'Totalvideos' array
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "Totalvideos",
        pipeline: [
          {
            // Lookup stage: Joins the 'likes' collection with the 'videos' collection
            // Finds all likes where the 'video' field matches the video's '_id'
            // Stores the results in the 'Videolikes' array
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "video",
              as: "Videolikes",
            },
          },
          {
            // Lookup stage: Joins the 'comments' collection with the 'videos' collection
            // Finds all comments where the 'video' field matches the video's '_id'
            // Stores the results in the 'TotalComments' array
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "video",
              as: "TotalComments",
            },
          },
          {
            // Add Fields stage: Adds a new field 'Videolikes' that takes the first element of the 'Videolikes' array
            $addFields: {
              Videolikes: {
                $first: "$Videolikes",
              },
            },
          },
          {
            // Add Fields stage: Adds a new field 'TotalComments' that calculates the size of the 'TotalComments' array
            $addFields: {
              TotalComments: {
                $size: "$TotalComments",
              },
            },
          },
        ],
      },
    },
    {
      // Lookup stage: Joins the 'subscriptions' collection with the 'users' collection
      // Finds all subscriptions where the 'channel' field matches the user's '_id'
      // Stores the results in the 'Subscribers' array
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "Subscribers",
      },
    },
    {
      // Lookup stage: Joins the 'subscriptions' collection with the 'users' collection
      // Finds all subscriptions where the 'subscriber' field matches the user's '_id'
      // Stores the results in the 'SubscribedTo' array
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "SubscribedTo",
      },
    },
    {
      // Lookup stage: Joins the 'tweets' collection with the 'users' collection
      // Finds all tweets where the 'owner' field matches the user's '_id'
      // Stores the results in the 'tweets' array
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "owner",
        as: "tweets",
        pipeline: [
          {
            // Lookup stage: Joins the 'likes' collection with the 'tweets' collection
            // Finds all likes where the 'tweet' field matches the tweet's '_id'
            // Stores the results in the 'TweetLikes' array
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "tweet",
              as: "TweetLikes",
            },
          },
          {
            // Add Fields stage: Adds a new field 'TweetLikes' that takes the first element of the 'TweetLikes' array
            $addFields: {
              TweetLikes: {
                $first: "$TweetLikes",
              },
            },
          },
        ],
      },
    },
    {
      // Lookup stage: Joins the 'comments' collection with the 'users' collection
      // Finds all comments where the 'owner' field matches the user's '_id'
      // Stores the results in the 'comments' array
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "owner",
        as: "comments",
        pipeline: [
          {
            // Lookup stage: Joins the 'likes' collection with the 'comments' collection
            // Finds all likes where the 'comment' field matches the comment's '_id'
            // Stores the results in the 'CommentLikes' array
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "comment",
              as: "CommentLikes",
            },
          },
          {
            // Add Fields stage: Adds a new field 'CommentLikes' that takes the first element of the 'CommentLikes' array
            $addFields: {
              CommentLikes: {
                $first: "$CommentLikes",
              },
            },
          },
        ],
      },
    },
    {
      // Project stage: Reshapes the documents to include only the desired fields
      // Excludes the _id field
      // Includes the fields: username, email, fullname, avatar, TotalComments, TotalViews, Totalvideos, Subscribers, SubscribedTo, TotalTweets, TotalLikes
      $project: {
        username: 1,
        email: 1,
        fullname: 1,
        avatar: 1,
        TotalComments: { $sum: "$Totalvideos.TotalComments" },
        TotalViews: { $sum: "$Totalvideos.views" },
        Totalvideos: { $size: "$Totalvideos" },
        Subscribers: { $size: "$Subscribers" },
        SubscribedTo: { $size: "$SubscribedTo" },
        TotalTweets: { $size: "$tweets" },
        TotalLikes: {
          videoLikes: { $size: "$Totalvideos.Videolikes" },
          tweetLikes: { $size: "$tweets.TweetLikes" },
          commentLikes: { $size: "$comments.CommentLikes" },
          total: { $sum: [{ $size: "$Totalvideos.Videolikes" }, { $size: "$tweets.TweetLikes" }, { $size: "$comments.CommentLikes" }] },
        },
      },
    },
  ]);
  

  if (!channelStatus) {
    throw new ApiError(500, "Some Internal error Occured");
  }

  // return response
  res.status(200).json(new ApiResponse(200, channelStatus[0], "Channel Stats"));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel

  // get user from req.user?._id
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // get all videos uploaded by the channel
  const videos = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        thumbnail: "$thumbnail.url",
        videoFile: "$videoFile.url",
        views: 1,
        duration: 1,
        isPublished: 1,
      },
    },
  ]);
  if (!videos) {
    throw new ApiError(500, "Some Internal error Occured");
  }

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, videos, "All videos uploaded by the channel"));
});

export { getChannelStats, getChannelVideos };
