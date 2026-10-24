import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Counter } from '@/features/counter/components/Counter'
import { useCounterStore } from '@/features/counter/store'

describe('Counter', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 })
  })

  it('renders the current count and increments on click', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    expect(screen.getByText('0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Increment' }))

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('resets the count', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
