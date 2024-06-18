import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary ,deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access and Referesh Tokens"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validate - not empty
  // check if user already exists : email,username
  // check for image, check for avatar
  // upload them to cloudinary, avatar
  // create user object - save to db
  // remove password and refresh token fields from response
  // check for user creation
  // return res

  // get user details from frontend
  const { username, email, fullname, password } = req.body;
  // console.log("email: " , email)

  // validate - not empty
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // check if user already exists : email,username
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User alrready exists with this email or username");
  }

  // check for image, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverimageLocalPath = req.files?.coverimage[0]?.path;
  let coverimageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverimage) &&
    req.files.coverimage.length > 0
  ) {
    coverimageLocalPath = req.files.coverimage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // upload them to cloudinary, avatar
  const avatar = await uploadToCloudinary(avatarLocalPath);
  const coverimage = await uploadToCloudinary(coverimageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  

  // create user object - save to db
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullname,
    password,
    avatar: avatar.url,
    coverimage: coverimage?.url || "",
  });

  // remove password and refresh token fields from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Succsfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie

  // req body -> data
  const { email, username, password } = req.body;

  // username or email
  if (!(username || email)) {
    throw new ApiError(400, "username or email required");
  }

  // find the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "user doesn't exist");
  }

  // password check
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // send cookie
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User LoggedIn successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, //this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logedOut Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.header.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Access");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is expired or Used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(400, error?.message || "Invalid Access");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const oldPasswordCheck = await user.isPasswordCorrect(oldPassword);

  if (!oldPasswordCheck) {
    throw new ApiError(400, "Invalid Old Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched Succesfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!(fullname || email)) {
    throw new ApiError(400, "please provide fullname or email");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullname, email },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Details updated Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarUrl = req.user?.avatar
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadToCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading Avatar on Cloudinary");
  }

//   //Delete Old Avatar from Cloudinary -- we can have the Public_id of any image in the end of image Url (ending with .png/.jpg/..) we can make a database query to get avatar or coverimage url of a user
    const oldAvatarUrl = avatarUrl.split('/')
    const oldAvatarId = oldAvatarUrl[oldAvatarUrl.length-1].split('.')[0]
    console.log( oldAvatarUrl[oldAvatarUrl.length-1].split('.')[0])
    const deleteImage = await deleteFromCloudinary(oldAvatarId)
    console.log(deleteImage) 

    

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated Successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverimageUrl = req.user?.coverimage

  const coverImageLocalPath = req.file?.path;

  if(!coverImageLocalPath){
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverimage = await uploadToCloudinary(coverImageLocalPath);
  if (!coverimage.url) {
    throw new ApiError(400, "Error while uploading CoverImage on Cloudinary");
  }

  //   //Delete Old coverimage from Cloudinary -- we can have the Public_id of any image in the end of image Url (ending with .png/.jpg/..) we can make a database query to get avatar or coverimage url of a user
  const oldCoverImageUrl = coverimageUrl.split('/')
  const oldCoverImageId = oldCoverImageUrl[oldCoverImageUrl.length-1].split('.')[0]
  console.log(oldCoverImageId)
  const deleteImage = await deleteFromCloudinary(oldCoverImageId)
  console.log(deleteImage) 


  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverimage: coverimage.url } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Succesfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res)=>{
  const {username} = req.params;

  if(!username?.trim()){
    throw new ApiError(400 , "Username is missing")
  }

  const channel = await User.aggregate([
    {
        $match :{
          username : username?.toLowerCase()
        }
    },
    { 
        $lookup : {
        from : "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"  
      }
    },
    {
      $lookup :{
        from : "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields:{
        subscriberCount :{
          $size : "$subscribers"
        },
        channelsSubscribedToCount :{
          $size : "$subscribedTo"
        },
        isSubscribed :{
          $cond :{
            if : {$in : [req.user?._id, "$subscribers.subscriber"]}, // In MongoDB's aggregation framework, The dot notation (.) is used to access the fields of embedded documents or arrays of documents.This is different from how dot notation is used in JavaScript, where it's used to access properties of objects. So, "$subscribers.subscriber" is referring to the subscriber field of each object within the subscribers array.
            then : true,
            else: false
          }
        }
        
      }
    },
    {
      $project:{
        fullname : 1,
        username : 1,
        subscriberCount : 1,
        channelsSubscribedToCount : 1, 
        isSubscribed : 1,
        avatar : 1,
        coverimage : 1,
        email : 1
      }
    }
  ])
  // console.log("channel Retured" , channel)

  if(!channel?.length){
    throw new ApiError(400 , "channel does not exists")
  }

  return res
  .status(200)
  .json(new ApiResponse(200, channel[0] , "channel fetched succesfully"))

})

const getWatchedHistory = asyncHandler(async (req,res)=>{
  
  const user = await User.aggregate([
    {
      $match : { 
              _id : new mongoose.Types.ObjectId(req.user._id)
            }
    },
    {
      $lookup :{
        from : "videos",
        localField : "watchhistory",
        foreignField : "_id",
        as : "watchhistory",
        pipeline : [
          { 
            $lookup :{
              from : "users",
              localField : "owner",
              foreignField : "_id",
              as : "owner",
              pipeline : [
                {
                  $project :{
                    fullname : 1,
                    username : 1,
                    avatar : 1
                  }
                }
              ]
            }
          },
          {
            $addFields : {
              owner : {
                $first : "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  // console.log("WatchedHistory user " , user[0].watchhistory)
  return res.status(200)
  .json(
    new ApiResponse(200 , user[0].watchhistory , "Watched history fetched succesfully")
  )

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchedHistory
};
