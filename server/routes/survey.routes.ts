import express from 'express';
import { surveyController } from '../controllers/survey.controller';

const router = express.Router();

/**
 * @route POST /api/surveys/submit
 * @desc Submit a new survey response
 * @access Public
 */
router.post('/submit', surveyController.submitSurvey);

/**
 * @route GET /api/surveys/contract/:contractId
 * @desc Get surveys for a specific contract
 * @access Private
 */
router.get('/contract/:contractId', surveyController.getSurveysByContract);

/**
 * @route GET /api/surveys/customer/:customerId
 * @desc Get surveys for a specific customer
 * @access Private
 */
router.get('/customer/:customerId', surveyController.getSurveysByCustomer);

export default router;