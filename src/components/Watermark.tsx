export default function Watermark() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Center large watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: 0.04,
          fontSize: 'clamp(4rem, 15vw, 12rem)',
          fontWeight: 900,
          letterSpacing: '-0.05em',
          color: '#808000',
          transform: 'rotate(-25deg)',
          whiteSpace: 'nowrap',
        }}
      >
        pinGGet
      </div>
      {/* Repeating tile pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 200px, rgba(128,128,0,0.015) 200px, rgba(128,128,0,0.015) 202px)`,
        }}
      />
      {/* Diagonal text pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Ctext x='50' y='150' fill='%23808000' fill-opacity='0.02' font-size='24' font-weight='bold' font-family='sans-serif' transform='rotate(-25 150 150)'%3EpinGGet%3C/text%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </div>
  )
}
