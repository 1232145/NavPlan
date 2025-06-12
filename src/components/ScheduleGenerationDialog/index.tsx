import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { Button } from '../Button';
import { Clock, Info, ListChecks } from 'lucide-react';
import './index.css';

export interface ScheduleGenerationOptions {
  startTime: string;
  endTime: string;
  prompt: string;
}

interface ScheduleGenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: ScheduleGenerationOptions) => void;
  title?: string;
  description?: string;
  placeCount?: number;
  isLocationBased?: boolean;
}

const ScheduleGenerationDialog: React.FC<ScheduleGenerationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = "Generate Schedule",
  description,
  placeCount,
  isLocationBased = false
}) => {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('19:00');
  const [prompt, setPrompt] = useState('');

  const handleClose = () => {
    onClose();
    // Reset form when closing
    setStartTime('09:00');
    setEndTime('19:00');
    setPrompt('');
  };

  const handleConfirm = () => {
    onConfirm({
      startTime,
      endTime,
      prompt
    });
  };

  const getDefaultDescription = () => {
    if (isLocationBased) {
      return "AI will discover amazing places near your location and create an optimized schedule.";
    }
    if (placeCount) {
      return `Generating a schedule for ${placeCount} places. Our AI will optimize your day based on locations and preferences.`;
    }
    return "Our AI will optimize your day based on locations and preferences.";
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      aria-labelledby="schedule-dialog-title"
    >
      <DialogTitle id="schedule-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <div className="schedule-dialog-content">
          <p className="schedule-dialog-label">
            <Clock size={16} /> Set your schedule time range:
          </p>
          <div className="time-inputs-container">
            <div className="time-input-group">
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
            <div className="time-input-group">
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
          
          <p className="schedule-dialog-label">
            <Info size={16} /> Custom preferences (optional):
          </p>
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder={isLocationBased 
              ? "E.g., 'I love outdoor activities and local food' or 'Focus on museums and cultural attractions'"
              : "E.g., 'I like family restaurants and outdoor activities' or 'Focus on cultural attractions and cafes'"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            margin="dense"
          />

          <div className="schedule-summary-info">
            <div className="schedule-summary-icon"><ListChecks size={16} /></div>
            <p>
              {description || getDefaultDescription()}
            </p>
          </div>
        </div>
      </DialogContent>
      <DialogActions className="schedule-dialog-actions">
        <Button variant="default" size="sm" onClick={handleClose}>Cancel</Button>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={handleConfirm}
        >
          Generate Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleGenerationDialog; 