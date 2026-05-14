'use client'
import { tinaField } from 'tinacms/dist/react'

const ICONS = {
  shield: (
    <svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  ),
  broadcast: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  ),
}

export default function TechGrid({ cards }) {
  return (
    <div className="tech-grid">
      {cards.map((card) => (
        <div key={card.label} className="tech-card reveal">
          <div className="tech-icon">{ICONS[card.iconKey] ?? ICONS.star}</div>
          <div
            className="tech-label"
            data-tina-field={tinaField(card, 'label')}
          >{card.label}</div>
          <div
            className="tech-name"
            data-tina-field={tinaField(card, 'name')}
          >{card.name}</div>
          <p
            className="tech-desc"
            data-tina-field={tinaField(card, 'desc')}
          >{card.desc}</p>
        </div>
      ))}
    </div>
  )
}
