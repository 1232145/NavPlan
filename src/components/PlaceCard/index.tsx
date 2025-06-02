import React, { useRef, useState } from 'react';
import { Place } from '../../types';
import './index.css';
import confetti from 'canvas-confetti';
import { Button } from '../Button';
import { Heart, Image as ImageIcon } from 'lucide-react';

export interface PlaceCardProps {
  place: Place;
  onAddToFavorites?: (place: Place) => void;
  onRemoveFavorite?: (place: Place) => void;
  isSaved?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, onAddToFavorites, onRemoveFavorite, isSaved = false }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showFullNote, setShowFullNote] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAddToFavorites = () => {
    if (onAddToFavorites && !isSaved) {
      onAddToFavorites(place);
      // Firework/confetti effect
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          },
          zIndex: 9999,
        });
      } else {
        confetti({ particleCount: 80, spread: 70, zIndex: 9999 });
      }
    }
  };

  // Note display logic
  const MAX_NOTE_PREVIEW = 120;
  const hasLongNote = place.note && place.note.length > MAX_NOTE_PREVIEW;
  const noteToShow = showFullNote || !hasLongNote ? place.note : place.note?.slice(0, MAX_NOTE_PREVIEW) + '...';

  return (
    <div className="place-card" ref={cardRef}>
      {place.photos && place.photos.length > 0 && !imageError ? (
        <img
          src={place.photos[0]}
          alt={place.name}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="place-image-placeholder">
          <ImageIcon size={32} />
          <span>{place.name}</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>{place.name}</h3>
        <p>{place.address}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
          {place.rating && (
            <span className="rating">★ {place.rating}{place.userRatingCount ? ` (${place.userRatingCount})` : ''}</span>
          )}
          {typeof place.priceLevel === 'number' && (
            <span style={{ fontSize: 13, color: '#555' }}>Price: {'$'.repeat(place.priceLevel)}</span>
          )}
          {place.businessStatus && (
            <span style={{ fontSize: 13, color: '#888' }}>Status: {place.businessStatus.replace('_', ' ')}</span>
          )}
          {place.openingHours && (
            <span style={{ fontSize: 13, color: place.openingHours.open ? '#2ecc40' : '#ff4136' }}>
              {place.openingHours.open ? 'Open now' : 'Closed now'}
            </span>
          )}
        </div>
        {place.phoneNumber && (
          <div style={{ fontSize: 13, marginBottom: 2 }}>
            <span role="img" aria-label="phone">📞</span> {place.phoneNumber}
          </div>
        )}
        {place.website && (
          <div style={{ fontSize: 13, marginBottom: 2 }}>
            <a href={place.website} target="_blank" rel="noopener noreferrer" style={{ color: '#0077cc', wordBreak: 'break-all' }}>Website</a>
          </div>
        )}
        {/* Note section */}
        {place.note && (
          <div style={{ margin: '8px 0 0 0', fontSize: 14, color: '#444', background: '#f8fafc', borderRadius: 6, padding: '8px 12px', position: 'relative' }}>
            <span style={{ fontWeight: 500, color: '#2563eb' }}>Note:</span> {noteToShow}
            {hasLongNote && (
              <Button
                variant="default"
                size="sm"
                style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12, verticalAlign: 'middle' }}
                onClick={() => setShowFullNote(v => !v)}
              >
                {showFullNote ? 'View less' : 'View more'}
              </Button>
            )}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {onAddToFavorites && (
            <button
              className={`heart-button ${isSaved ? 'saved' : ''}`}
              onClick={handleAddToFavorites}
              disabled={isSaved}
              aria-label={isSaved ? "Place is saved" : "Add to favorites"}
            >
              <Heart size={25} fill={isSaved ? "#ef4444" : "none"} />
            </button>
          )}
          {onRemoveFavorite && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onRemoveFavorite(place)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 