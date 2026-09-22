// @system — application error classes
// Throw these from route handlers / services; the app.js error handler maps
// `status` to the HTTP response. Default messages are user-facing (safe to
// show verbatim in the UI) — never put internal details in the default text.
//
//   throw new NotFoundError()                       // 404, friendly default
//   throw new ValidationError('Email is required.') // 400, custom copy
//   throw new AppError('Upstream failed', 502)      // any status

class AppError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

class NotFoundError extends AppError {
  constructor(message = 'The requested resource could not be found.') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

class ValidationError extends AppError {
  constructor(message = 'The information provided is invalid. Please check your input and try again.') {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

module.exports = { AppError, NotFoundError, ValidationError }
