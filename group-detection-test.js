// Group Detection Test - Add this to popup.js for debugging

window.testGroupDetection = function() {
    console.log('🔧 Testing group detection button setup...');
    
    // Test button existence
    const detectBtn = document.getElementById('detectGroupsBtn');
    const detectAllBtn = document.getElementById('detectAllGroupsBtn');
    
    console.log('detectGroupsBtn found:', !!detectBtn);
    console.log('detectAllGroupsBtn found:', !!detectAllBtn);
    
    if (detectBtn) {
        console.log('detectGroupsBtn disabled:', detectBtn.disabled);
        console.log('detectGroupsBtn text:', detectBtn.textContent);
    }
    
    if (detectAllBtn) {
        console.log('detectAllGroupsBtn disabled:', detectAllBtn.disabled);
        console.log('detectAllGroupsBtn text:', detectAllBtn.textContent);
    }
    
    // Test GruposManager existence
    if (window.gruposManager) {
        console.log('✅ GruposManager is available');
        console.log('GruposManager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.gruposManager)));
    } else {
        console.log('❌ GruposManager not found');
    }
    
    // Test manual button click
    console.log('🖱️ Testing manual button click...');
    if (detectBtn && window.gruposManager) {
        try {
            detectBtn.click();
            console.log('✅ Button click triggered successfully');
        } catch (error) {
            console.error('❌ Error clicking button:', error);
        }
    }
};

window.manualGroupScan = async function() {
    console.log('🔍 Starting manual group scan...');
    if (window.gruposManager) {
        try {
            await window.gruposManager.escanearGrupos();
            console.log('✅ Manual scan completed');
        } catch (error) {
            console.error('❌ Manual scan failed:', error);
        }
    } else {
        console.error('❌ GruposManager not available');
    }
};

console.log('🎯 Group detection test functions loaded. Use:');
console.log('- testGroupDetection() to test button setup');
console.log('- manualGroupScan() to manually trigger group scan');
