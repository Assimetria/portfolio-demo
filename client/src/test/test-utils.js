// @system — Shared test utilities
// Import this instead of @testing-library/react directly.
// Automatically loads jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
import '@testing-library/jest-dom'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export { render, screen, within, waitFor, userEvent }
