import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchedHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route('/register').post(
    upload.fields([
        {
            name: 'avatar',
            maxCount: 1
        },
        {
            name : 'coverimage',
            maxCount: 1
        }
    ]),
    registerUser
)

router.route('/login').post(loginUser)

// secured routes
router.route('/logout').post(verifyJWT , logoutUser)
router.route('/refresh-token').post(refreshAccessToken)

router.route('/change-password').post(verifyJWT , changeCurrentPassword)
router.route('/current-user').get(verifyJWT , getCurrentUser)
router.route('/update-details').patch(verifyJWT , updateAccountDetails)

router.route('/avatar-update').patch(verifyJWT , upload.single('avatar') , updateUserAvatar)
router.route('/coverimage-update').patch(verifyJWT , upload.single('coverimage'), updateUserCoverImage)

router.route('/channel/:username').get(verifyJWT , getUserChannelProfile)
router.route('/history').get(verifyJWT, getWatchedHistory)


export default router;