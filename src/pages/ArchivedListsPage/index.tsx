import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';

interface ArchivedListsPageProps {
  onBack: () => void;
}

export const ArchivedListsPage: React.FC<ArchivedListsPageProps> = ({ onBack }) => {
  const { archivedLists } = useAppContext();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="archived-lists-page">
      <Button variant="primary" size="md" onClick={onBack} style={{ marginBottom: 24 }}>
        Back to Map
      </Button>
      <h2 className="archived-title">Archived Lists</h2>
      {archivedLists.length === 0 ? (
        <p className="archived-empty">No archived lists yet.</p>
      ) : (
        <div className="archived-list-container">
          {archivedLists.map(list => (
            <div key={list.id} className="archived-list-folder">
              <div className="archived-list-header" onClick={() => setExpanded(expanded === list.id ? null : list.id)}>
                <div>
                  <div className="archived-list-name">{list.name}</div>
                  <div className="archived-list-date">{list.date}</div>
                </div>
                <span className="archived-expand-icon">{expanded === list.id ? '▼' : '▶'}</span>
              </div>
              {expanded === list.id && (
                <div className="archived-list-places">
                  {list.places.length === 0 ? (
                    <div className="archived-list-empty">No places in this list.</div>
                  ) : (
                    <ul className="archived-place-list">
                      {list.places.map(place => (
                        <li key={place.id} className="archived-place-item">
                          <div className="archived-place-name">{place.name}</div>
                          <div className="archived-place-address">{place.address}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 