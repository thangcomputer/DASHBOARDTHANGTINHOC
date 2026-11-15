'use strict';

const mongoose = require('mongoose');

const clientTelemetryEventSchema = new mongoose.Schema({
  kind: {
    type: String,
    required: true,
    enum: ['vital', 'error'],
    index: true,
  },
  // Core Web Vitals fields (when kind === 'vital')
  name: {
    type: String,
    default: '',
    trim: true,
    index: true,
  },
  value: {
    type: Number,
    default: null,
  },
  delta: {
    type: Number,
    default: null,
  },
  rating: {
    type: String,
    enum: ['good', 'needs-improvement', 'poor', ''],
    default: '',
    index: true,
  },
  navigationType: {
    type: String,
    default: '',
    trim: true,
  },
  // Shared context
  route: {
    type: String,
    default: '/',
    trim: true,
    index: true,
  },
  source: {
    type: String,
    enum: ['frontend', 'backend'],
    default: 'frontend',
    index: true,
  },
  userRole: {
    type: String,
    default: 'anonymous',
    trim: true,
  },
  userId: {
    type: String,
    default: '',
    trim: true,
  },
  browser: {
    type: String,
    default: '',
    trim: true,
  },
  os: {
    type: String,
    default: '',
    trim: true,
  },
  deviceType: {
    type: String,
    default: 'desktop',
    trim: true,
  },
  viewport: {
    type: String,
    default: '',
    trim: true,
  },
  connectionType: {
    type: String,
    default: '',
    trim: true,
  },
  release: {
    type: String,
    default: '',
    trim: true,
  },
  environment: {
    type: String,
    default: 'production',
    trim: true,
  },
  // Error issue tracker fields (when kind === 'error')
  fingerprint: {
    type: String,
    default: '',
    index: true,
  },
  message: {
    type: String,
    default: '',
  },
  stack: {
    type: String,
    default: '',
  },
  componentStack: {
    type: String,
    default: '',
  },
  statusCode: {
    type: Number,
    default: null,
  },
  httpMethod: {
    type: String,
    default: '',
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true,
  },
  resolvedBy: {
    type: String,
    default: '',
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  sentryForwarded: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
}, {
  timestamps: true,
});

clientTelemetryEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
clientTelemetryEventSchema.index({ kind: 1, createdAt: -1 });
clientTelemetryEventSchema.index({ kind: 1, name: 1, createdAt: -1 });
clientTelemetryEventSchema.index({ kind: 1, fingerprint: 1, createdAt: -1 });

module.exports = mongoose.model('ClientTelemetryEvent', clientTelemetryEventSchema);

