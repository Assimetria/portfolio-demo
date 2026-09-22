// @system — Facebook Ads Manager integration
// Mirrors Asymetric Ventures' FacebookAds integration for campaign management.
// Required env vars:
//   FACEBOOK_ACCESS_TOKEN    — Long-lived access token
//   FACEBOOK_AD_ACCOUNT_ID   — Ad account ID (with or without act_ prefix)
//
// Usage:
//   const FacebookAds = require('../FacebookAds')
//   const campaign = await FacebookAds.createCampaign('My Campaign')
//   const adSet = await FacebookAds.createAdSet({ ... })

'use strict'

const logger = require('../Logger')

let sdk = null
let adAccount = null

function init() {
  if (adAccount) return adAccount
  if (!process.env.FACEBOOK_ACCESS_TOKEN || !process.env.FACEBOOK_AD_ACCOUNT_ID) return null

  try {
    sdk = require('facebook-nodejs-business-sdk')
    const { FacebookAdsApi, AdAccount } = sdk
    FacebookAdsApi.init(process.env.FACEBOOK_ACCESS_TOKEN)

    let accountId = process.env.FACEBOOK_AD_ACCOUNT_ID
    if (!accountId.includes('act_')) accountId = `act_${accountId}`
    adAccount = new AdAccount(accountId)
    return adAccount
  } catch (err) {
    logger.warn({ err }, '[FacebookAds] SDK not installed or init failed')
    return null
  }
}

const FacebookAds = {
  isConfigured() {
    return !!(process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_AD_ACCOUNT_ID)
  },

  async createCampaign(name, { objective = 'OUTCOME_ENGAGEMENT', status = 'ACTIVE', specialAdCategories = [] } = {}) {
    const account = init()
    if (!account) throw new Error('Facebook Ads not configured')

    try {
      const { Campaign } = sdk
      const campaign = await account.createCampaign([], {
        name,
        objective: Campaign.Objective[objective.toLowerCase()] || objective,
        status: Campaign.Status[status.toLowerCase()] || status,
        special_ad_categories: specialAdCategories,
      })
      logger.info({ campaignId: campaign.id }, '[FacebookAds] campaign created')
      return campaign
    } catch (err) {
      logger.error({ err, name }, '[FacebookAds] createCampaign failed')
      throw err
    }
  },

  async createAdSet({ campaignId, name, dailyBudget, targeting, startTime, billingEvent = 'IMPRESSIONS', optimizationGoal = 'REACH' }) {
    const account = init()
    if (!account) throw new Error('Facebook Ads not configured')

    try {
      const adSet = await account.createAdSet([], {
        campaign_id: campaignId,
        name,
        daily_budget: dailyBudget,
        targeting,
        start_time: startTime || new Date().toISOString(),
        billing_event: billingEvent,
        optimization_goal: optimizationGoal,
        status: 'ACTIVE',
      })
      logger.info({ adSetId: adSet.id }, '[FacebookAds] ad set created')
      return adSet
    } catch (err) {
      logger.error({ err, name }, '[FacebookAds] createAdSet failed')
      throw err
    }
  },

  async createAd({ adSetId, name, creativeId }) {
    const account = init()
    if (!account) throw new Error('Facebook Ads not configured')

    try {
      const ad = await account.createAd([], {
        adset_id: adSetId,
        name,
        creative: { creative_id: creativeId },
        status: 'ACTIVE',
      })
      logger.info({ adId: ad.id }, '[FacebookAds] ad created')
      return ad
    } catch (err) {
      logger.error({ err, name }, '[FacebookAds] createAd failed')
      throw err
    }
  },

  async createCreative({ name, objectStorySpec }) {
    const account = init()
    if (!account) throw new Error('Facebook Ads not configured')

    try {
      const creative = await account.createAdCreative([], {
        name,
        object_story_spec: objectStorySpec,
      })
      logger.info({ creativeId: creative.id }, '[FacebookAds] creative created')
      return creative
    } catch (err) {
      logger.error({ err, name }, '[FacebookAds] createCreative failed')
      throw err
    }
  },

  async searchTargeting(query) {
    const account = init()
    if (!account) throw new Error('Facebook Ads not configured')

    try {
      const { TargetingSearch } = sdk
      const results = await TargetingSearch.search('adinterest', null, query)
      return results
    } catch (err) {
      logger.error({ err, query }, '[FacebookAds] searchTargeting failed')
      throw err
    }
  },

  health() {
    return {
      provider: 'facebook-ads',
      configured: this.isConfigured(),
      envVars: ['FACEBOOK_ACCESS_TOKEN', 'FACEBOOK_AD_ACCOUNT_ID'],
    }
  },
}

module.exports = FacebookAds
