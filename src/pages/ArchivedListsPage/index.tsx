import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { ArchivedList } from '../../types';
import { archivedListService } from '../../services/archivedListService';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

const ArchivedListsPage: React.FC = () => {
  const { generateSchedule } = useAppContext();
  const [archivedLists, setArchivedLists] = useState<ArchivedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Schedule modal state for choosing start time
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('19:00');
  const [prompt, setPrompt] = useState('');
  const [selectedList, setSelectedList] = useState<ArchivedList | null>(null);

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

  const handleGenerateSchedule = (list: ArchivedList) => {
    setSelectedList(list);
    setScheduleOpen(true);
  };

  const handleScheduleClose = () => {
    setScheduleOpen(false);
    setSelectedList(null);
    setPrompt('');
  };

  const handleScheduleConfirm = async () => {
    // Move focus to a safe element before navigation
    document.body.focus();
    // Close the modal first to avoid aria-hidden issues
    setScheduleOpen(false);
    
    // Wait a bit to ensure modal is closed before generating schedule
    setTimeout(async () => {
      if (selectedList) {
        await generateSchedule(
          startTime, 
          "walking", 
          prompt, 
          selectedList.places, 
          undefined, 
          selectedList.places.length,
          endTime
        );
        navigate('/schedule');
      }
    }, 50);
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
      
      {/* Schedule Modal */}
      <Dialog 
        open={scheduleOpen} 
        onClose={handleScheduleClose} 
        maxWidth="xs" 
        fullWidth
        aria-labelledby="schedule-dialog-title"
      >
        <DialogTitle id="schedule-dialog-title">Generate Schedule</DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <p>Start time:</p>
              <TextField
                type="time"
                fullWidth
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                margin="dense"
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p>End time:</p>
              <TextField
                type="time"
                fullWidth
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                margin="dense"
                InputLabelProps={{ shrink: true }}
              />
            </div>
          </div>
          
          <p style={{ marginTop: '16px' }}>Custom preferences (optional):</p>
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder="E.g., 'Focus on outdoor activities' or 'Include more food stops'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            margin="dense"
            label="Preferences"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="default" size="sm" onClick={handleScheduleClose}>Cancel</Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleScheduleConfirm}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>
      
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
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleGenerateSchedule(list)}
                        style={{ marginBottom: 12 }}
                      >
                        Generate Schedule
                      </Button>
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