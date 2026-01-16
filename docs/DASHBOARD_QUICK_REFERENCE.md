# Dashboard Quick Reference

## What's New - At a Glance

### 🎯 Main Improvements

1. **Welcome & Status Card** (Blue gradient at top)
   - Time-based greeting
   - Status message
   - Device count (X of Y running)
   - Last update time
   - Yesterday comparison

2. **Stats Card** (Dark gradient)
   - Current power usage
   - Today's energy and cost
   - Monthly projection

3. **Quick Access** (When you have favorites)
   - Fast toggle switches
   - Device runtime
   - One-tap control

4. **Cost Consumers** (💸)
   - Devices by bill impact
   - Shows actual cost per device
   - Quick toggles included

5. **Energy Consumers** (⚡)
   - Devices by kWh usage
   - Shows percentage of total

---

## 📋 User Actions

### From Dashboard You Can Now:
- ✅ See if usage is normal or high
- ✅ Compare with yesterday
- ✅ Toggle any device on/off
- ✅ See how long devices have been running
- ✅ View monthly cost projection
- ✅ Identify biggest cost consumers
- ✅ Check when data was last updated

---

## 🎨 Visual Guide

### Icons Meaning
- ⚡ = Power/Energy usage
- 💰 = Cost/Money today
- 💸 = Bill impact/Expenses
- ⭐ = Your favorites
- 📊 = Estimates/Projections
- 📉 = Usage decreased
- 📈 = Usage increased

### Colors Meaning
- 🟢 Green = Good/On/Saved
- 🟠 Orange = Warning/Increased
- 🔵 Blue = Info/Neutral
- 🔴 Red = Off/Critical
- ⚫ Gray = Inactive

### Device Icons
- ❄️ Fridge/Freezer
- 🌀 Washer/Dryer
- 🌡️ Air Conditioner
- 🔥 Heater/Furnace
- 💧 Water Heater
- 💡 Lights
- 📺 TV/Entertainment
- 🔌 Other Devices

---

## 📱 Mobile Tips

### Best Practices
- Toggle switches are larger (easier to tap)
- Device rows have more space
- Tap device name → see details
- Tap toggle → turn on/off
- No zooming needed

### Touch Targets
- Toggles: 56×28px (easy to hit)
- Device rows: 60px tall (comfortable)
- Buttons: 48px+ (standard size)

---

## 🔄 Data Updates

### Auto-Updates
- Last update time refreshes every minute
- Yesterday comparison saved at midnight
- Device states update in real-time via MQTT

### Manual Actions
- Pull down to refresh (if implemented)
- Click device to see live details
- Toggle updates immediately

---

## 💡 Pro Tips

1. **Check greeting time**: Verify it matches your local time
2. **Watch yesterday comparison**: Track your improvement over time
3. **Use Quick Access**: Add frequent devices for fastest control
4. **Monitor runtime**: Spot devices left on accidentally
5. **Review cost consumers**: Focus on high-bill devices first
6. **Check monthly projection**: Plan budget accordingly

---

## 📚 Documentation Files

- **DASHBOARD_IMPROVEMENTS.md** - Feature details
- **DASHBOARD_UX_ANALYSIS.md** - UX review and issues
- **DASHBOARD_IMPROVEMENTS_SUMMARY.md** - Complete overview
- **DASHBOARD_CHECKLIST.md** - Before/after comparison
- **DASHBOARD_QUICK_REFERENCE.md** - This file

---

## 🐛 Known Limitations

1. Runtime is approximate (~2h means "about 2 hours")
2. Monthly projection assumes today's pattern continues
3. Yesterday comparison needs 24 hours of data
4. Favorites feature UI needs to be added to device pages

---

## 🎉 Quick Win Examples

### Example 1: Morning Check
Open dashboard → "Good morning! Your home is running efficiently. 2 of 5 devices running. You're using 25% less than yesterday - great job!"

### Example 2: Forgot Device
Scan list → "Living room light ~8h 15m" → Tap toggle → Off

### Example 3: Budget Check
See "Est. Monthly: $65.40" → Check "💸 Costing Most" → Heater is #1 at $1.85 today

---

## Need Help?

- Check STATUS.md for system status
- Read SETUP_GUIDE.md for configuration
- Review TESTING.md for validation steps
- See DEPLOYMENT.md for hosting info

---

Last Updated: After Dashboard improvements implementation
Build Status: ✅ Passing
