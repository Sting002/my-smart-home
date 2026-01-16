# Automation System Improvements

## Overview
The automation system has been significantly enhanced with multiple trigger types, better UI, and comprehensive rule management capabilities.

## New Features

### 1. **Multiple Trigger Types**

#### Power-Based Triggers
- Monitor device power consumption
- Trigger when power exceeds threshold for a specified duration
- Example: "Turn off TV if power > 200W for 30 minutes"

#### Time-Based Triggers
- Execute actions at specific times daily
- Precise hour and minute control (24-hour format)
- Example: "Turn off lights at 23:00 every day"

#### Schedule-Based Triggers
- Execute actions on specific days of the week
- Select multiple days (Monday through Sunday)
- Specify exact time for each scheduled day
- Example: "Turn off heating on Monday, Wednesday, Friday at 08:00"

### 2. **Enhanced Actions**

- **Notify**: Send in-app notification
- **Turn Off**: Power down the device
- **Turn On**: Power up the device (NEW)

### 3. **Rule Management**

#### Enable/Disable Toggle
- Temporarily disable rules without deleting them
- Visual indicator shows rule status (green = enabled, gray = disabled)
- Quick toggle button for each rule

#### Better Visual Design
- Color-coded status indicators
- Improved rule cards with clear information hierarchy
- Trigger type badges (power/time/schedule)
- Last triggered timestamp display
- Empty state with friendly illustration

### 4. **Smart Time Handling**

The system uses correct local time with proper date/time logic:
- Respects local timezone
- Accurate day-of-week detection (Sunday = 0, Monday = 1, etc.)
- Prevents duplicate triggers on the same day
- Time-based rules trigger only once per day at the specified time

### 5. **Validation & User Feedback**

- Form validation for all trigger types
- Clear error messages
- Success notifications when rules are created/modified/deleted
- Real-time action feedback with descriptive toast messages

## Technical Implementation

### Data Structure
```typescript
interface Rule {
  id: string;
  deviceId: string;
  triggerType: "power" | "time" | "schedule";
  
  // Power trigger fields
  thresholdW: number;
  minutes: number;
  
  // Time trigger fields
  timeHour: number;      // 0-23
  timeMinute: number;    // 0-59
  
  // Schedule trigger fields
  scheduleDays: ScheduleDay[];  // ["monday", "friday", ...]
  scheduleTime: string;          // "22:00"
  
  // Action & state
  action: "notify" | "turnOff" | "turnOn";
  enabled: boolean;
  lastTriggered?: number;
}
```

### Automation Runner
- Checks rules every 5 seconds
- Separate tracking for each trigger type
- Prevents duplicate executions with reference tracking
- Updates localStorage when rules are triggered
- Handles MQTT connectivity gracefully

### Time Precision
- Current time: `new Date()`
- Day detection: `["sunday", "monday", ...][date.getDay()]`
- Hour/minute matching for time-based triggers
- Daily key tracking to prevent duplicate triggers: `date.toDateString()`

## Usage Examples

### Example 1: Energy Saver
**Trigger**: Power-based  
**Device**: Air Conditioner  
**Condition**: Power > 2000W for 60 minutes  
**Action**: Turn off  
**Result**: Prevents excessive power usage during long running periods

### Example 2: Night Mode
**Trigger**: Time-based  
**Device**: Living Room Lights  
**Time**: 22:30 daily  
**Action**: Turn off  
**Result**: Automatic lights-off every night

### Example 3: Workday Morning Routine
**Trigger**: Schedule-based  
**Device**: Coffee Maker  
**Days**: Monday, Tuesday, Wednesday, Thursday, Friday  
**Time**: 07:00  
**Action**: Turn on  
**Result**: Coffee maker starts only on weekdays

### Example 4: Weekend Energy Alert
**Trigger**: Power-based  
**Device**: Gaming PC  
**Condition**: Power > 500W for 120 minutes  
**Action**: Notify  
**Result**: Alert when gaming session is long

## UI Improvements

1. **Trigger Type Selection**: Visual button group to select power/time/schedule
2. **Conditional Forms**: Only show relevant fields based on trigger type
3. **Day Selector**: Interactive buttons for selecting weekdays
4. **Rule Cards**: Rich display with status, trigger info, and action
5. **Toggle Controls**: Easy enable/disable without deletion
6. **Empty State**: Friendly message with emoji when no rules exist

## Future Enhancement Possibilities

- Multiple conditions (AND/OR logic)
- Delay actions (wait X minutes then execute)
- Device groups (apply rule to multiple devices)
- Rule templates for common scenarios
- Export/Import rules
- Rule conflict detection
- Test rule functionality
- Email/SMS notifications
- Dimming controls for compatible devices
- Historical analytics per rule

## Migration Notes

Existing rules will continue to work with backward compatibility:
- Old rules default to `triggerType: "power"`
- Old rules default to `enabled: true`
- Time-based fields have default values
- Schedule fields default to empty arrays

## Testing Recommendations

1. Create a power-based rule and verify it triggers when threshold is exceeded
2. Create a time-based rule for 1 minute in the future and verify it executes
3. Create a schedule rule for today and verify it runs at the specified time
4. Test enable/disable toggle functionality
5. Verify rules don't execute when disabled
6. Check that time-based rules only trigger once per day
7. Verify correct day-of-week detection for schedule rules
