import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { ArchivedList } from '../../types';
import { archivedListService } from '../../services/archivedListService';

const ArchivedListsPage: React.FC = () => {
  const [archivedLists, setArchivedLists] = useState<ArchivedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchArchivedLists();
  }, []);

  const fetchArchivedLists = async () => {
    try {
      setLoading(true);
      const lists = await archivedListService.getLists();
      setArchivedLists(lists);
      setError(null);
    } catch (err) {
      setError('Failed to load archived lists');
      console.error('Error fetching archived lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    navigate('/map');
  };

  if (loading) {
    return (
      <div className="archived-lists-page">
        <Button variant="primary" size="md" onClick={onBack} style={{ marginBottom: 24 }}>
          Back to Map
        </Button>
        <div className="loading-state">Loading archived lists...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="archived-lists-page">
        <Button variant="primary" size="md" onClick={onBack} style={{ marginBottom: 24 }}>
          Back to Map
        </Button>
        <div className="error-state">{error}</div>
      </div>
    );
  }

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
                  <div className="archived-list-date">{new Date(list.date).toLocaleString()}</div>
                </div>
                <span className="archived-expand-icon">{expanded === list.id ? '▼' : '▶'}</span>
              </div>
              {expanded === list.id && (
                <div className="archived-list-places">
                  {list.places.length === 0 ? (
                    <div className="archived-list-empty">No places in this list.</div>
                  ) : (
                    <>
                      {list.note && (
                        <div className="archived-list-note">
                          <strong>Note:</strong> {list.note}
                        </div>
                      )}
                      <ul className="archived-place-list">
                        {list.places.map(place => (
                          <li key={place.id} className="archived-place-item">
                            <div className="archived-place-name">{place.name}</div>
                            <div className="archived-place-address">{place.address}</div>
                            {place.note && (
                              <div className="archived-place-note">{place.note}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
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

export default ArchivedListsPage; 