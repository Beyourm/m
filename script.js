let items = [];
let invoices = [];
let customers = [];
let currentInvoiceItems = [];
let invoiceCounter = 1;
let editingIndex = -1;
const todayDate = new Date().toISOString().split('T')[0];

// --- تحسين: بدء التحميل بعد اكتمال تحميل DOM بدلاً من onload في وسم body ---
document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    // إعداد تاريخ اليوم كقيمة افتراضية
    document.getElementById('invoiceDate').value = todayDate;
    // ربط مستمع الحدث الخاص بتغيير الصنف لتحديث وحدات البيع
    document.getElementById('invoiceItemSelect').addEventListener('change', populateSellUnits);
});

// --- وظيفة التحكم بحقول التحويل الثلاثية --- 
function togglePackageField() {
    const unit = document.getElementById("itemUnit").value;
    const packageFieldContainer = document.getElementById("packageFieldContainer");
    const packPerCartonInput = document.getElementById("packPerCarton");
    const unitsPerPackInput = document.getElementById("unitsPerPack");

    // نُظهر الحقول فقط لوحدة 'كرتون'
    if (unit === "كرتون") {
        packageFieldContainer.style.display = "block";
        packPerCartonInput.focus(); 
    } else {
        packageFieldContainer.style.display = "none";
        // تفريغ الحقول عند الإخفاء لعدم حفظ قيم خاطئة
        packPerCartonInput.value = ""; 
        unitsPerPackInput.value = ""; 
    }
}

// --- وظيفة التبويبات (Tabs Functionality) ---
function openTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[onclick="openTab('${tabId}')"]`).classList.add('active');

    // تحديث المحتوى الخاص بالتبويبات عند الفتح
    if (tabId === 'reports') { renderReports(); }
    if (tabId === 'customers') { renderCustomersTable(); }
    if (tabId === 'sales') { renderInvoiceForm(); }
    if (tabId === 'physicalCount') { renderPhysicalCountTable(); } // **تمت الإضافة هنا**
}

// --- وظائف التخزين (Local Storage) ---
function saveItems() {
    try {
        localStorage.setItem('inventoryItems', JSON.stringify(items));
        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('customers', JSON.stringify(customers));
        localStorage.setItem('invoiceCounter', invoiceCounter);
    } catch (e) {
        console.error("خطأ في حفظ البيانات:", e);
        alert("فشل حفظ البيانات. قد تكون الذاكرة ممتلئة.");
    }
}

function loadItems() {
    try {
        const storedItems = localStorage.getItem('inventoryItems');
        if (storedItems) {
            items = JSON.parse(storedItems);
            items = items.map(item => ({
                ...item,
                price_purchase: item.price_purchase || 0,
                lastModified: item.lastModified || todayDate, 
                isEditing: item.isEditing || false,
                // إضافة تهيئة للحقول الجديدة
                packPerCarton: item.packPerCarton || 0, 
                unitsPerPack: item.unitsPerPack || 0,
                totalUnits: item.totalUnits || 0, // إجمالي الحبات في الوحدة الكبرى
            }));
        }
        const storedInvoices = localStorage.getItem('invoices');
        if (storedInvoices) {
            invoices = JSON.parse(storedInvoices);
        }
        const storedCustomers = localStorage.getItem('customers');
        if (storedCustomers) {
            customers = JSON.parse(storedCustomers);
        }
        const storedCounter = localStorage.getItem('invoiceCounter');
        if (storedCounter) {
            invoiceCounter = parseInt(storedCounter);
        }
    } catch (e) {
        console.error("خطأ في تحميل البيانات:", e);
        alert("تم تحميل بيانات تالفة. سيتم بدء العمل ببيانات فارغة.");
        items = []; invoices = []; customers = []; invoiceCounter = 1;
    }
    
    renderTable(); 
    renderInvoiceForm(); 
    renderInvoicesList(); 
}

// --- وظائف إدارة المخزون (Inventory) ---

function addItem() {
    const name = document.getElementById('itemName').value.trim();
    const priceSale = parseFloat(document.getElementById('itemPriceSale').value);
    const pricePurchase = parseFloat(document.getElementById('itemPricePurchase').value);
    const qty = parseInt(document.getElementById('itemQty').value);
    const unit = document.getElementById('itemUnit').value;
    
    let packPerCarton = 0;
    let unitsPerPack = 0;
    let totalUnits = 0;

    if (!name || !unit) { alert("يرجى إدخال اسم الصنف واختيار الوحدة."); return; }
    if (isNaN(priceSale) || isNaN(pricePurchase) || isNaN(qty) || priceSale <= 0 || pricePurchase < 0 || qty < 0) { 
        alert("يرجى إدخال سعر بيع صحيح (> 0)، سعر شراء صحيح (>= 0)، وكمية صحيحة (>= 0).");
        return;
    }
    
    // التحقق من حقول التحويل إذا كانت الوحدة كرتون
    if (unit === "كرتون") {
        packPerCarton = parseInt(document.getElementById('packPerCarton').value);
        unitsPerPack = parseInt(document.getElementById('unitsPerPack').value);

        if (isNaN(packPerCarton) || isNaN(unitsPerPack) || packPerCarton <= 0 || unitsPerPack <= 0) {
            alert("يرجى تحديد عدد الباكتات في الكرتون وعدد الحبات في الباكت بأرقام صحيحة أكبر من صفر.");
            return;
        }
        totalUnits = packPerCarton * unitsPerPack; // حساب إجمالي الحبات في الكرتون
    }
    
    // منع سعر البيع الأقل من سعر الشراء
    if (priceSale < pricePurchase) {
        alert("خطأ: سعر البيع يجب أن يكون أكبر من أو يساوي سعر الشراء لتجنب الخسارة المباشرة.");
        return;
    }

    const existingItemIndex = items.findIndex(item => item.name === name && item.unit === unit);
    const currentDate = new Date().toISOString().split('T')[0];

    if (existingItemIndex > -1) {
        // تحديث الصنف الحالي
        items[existingItemIndex].qty += qty;
        items[existingItemIndex].price = priceSale; 
        items[existingItemIndex].price_purchase = pricePurchase; 
        items[existingItemIndex].lastModified = currentDate;
        
        // تحديث عوامل التحويل إذا كانت الوحدة كرتون
        if (unit === "كرتون") {
            items[existingItemIndex].packPerCarton = packPerCarton;
            items[existingItemIndex].unitsPerPack = unitsPerPack;
            items[existingItemIndex].totalUnits = totalUnits;
        }
    } else {
        // إضافة صنف جديد
        items.push({ 
            name, 
            price: priceSale, 
            price_purchase: pricePurchase, 
            qty, 
            unit, 
            lastModified: currentDate, 
            isEditing: false,
            packPerCarton, // الحقول الجديدة
            unitsPerPack,
            totalUnits
        });
    }

    // تفريغ الحقول بعد الإضافة
    document.getElementById('itemName').value = document.getElementById('itemPriceSale').value = '';
    document.getElementById('itemPricePurchase').value = document.getElementById('itemQty').value = '';
    document.getElementById('itemUnit').value = 'حبة'; 
    document.getElementById('packPerCarton').value = ''; 
    document.getElementById('unitsPerPack').value = ''; 
    togglePackageField(); // إخفاء حقول التحويل

    saveItems();
    renderTable();
    renderInvoiceForm();
}

function renderTable() {
    const tableBody = document.querySelector('#itemsTable tbody');
    const tableFoot = document.querySelector('#itemsTable tfoot');
    
    tableBody.innerHTML = '';
    tableFoot.innerHTML = '';

    const inventorySearchText = document.getElementById('inventorySearch').value.toLowerCase();
    
    let grandTotalValue = 0; 

    items.forEach((item, index) => {
        const total = item.price_purchase * item.qty; 
        grandTotalValue += total;

        const isMatch = item.name.toLowerCase().includes(inventorySearchText) ||
                        item.unit.toLowerCase().includes(inventorySearchText) ||
                        item.price.toString().includes(inventorySearchText) ||
                        item.price_purchase.toString().includes(inventorySearchText);
        
        if (inventorySearchText && !isMatch) {
            return;
        }

        const tr = document.createElement('tr');
        if (item.qty < 10 && item.qty > 0 && !item.isEditing) { 
            tr.classList.add('low-stock');
        } else if (item.qty === 0 && !item.isEditing) {
            tr.style.backgroundColor = '#f8d7da';
        }
        
        // عرض الكمية/العبوة وفق المنطق الثلاثي
        let qtyDisplay = `${item.qty.toFixed(2)} ${item.unit}`; // Fix toFixed(2) to show fractional quantity after sales
        if (item.unit === 'كرتون' && item.totalUnits > 0) {
            qtyDisplay = `${item.qty.toFixed(2)} ${item.unit} (${item.packPerCarton}x${item.unitsPerPack} حبة)`;
        } else if (item.unit === 'باكت' && item.unitsPerPack > 0) {
             qtyDisplay = `${item.qty.toFixed(2)} ${item.unit} (${item.unitsPerPack} حبة)`;
        }

        if (item.isEditing) {
             let conversionInputs = '';
             if (item.unit === 'كرتون') {
                conversionInputs = `
                    <div style="margin-top: 5px;">
                        <input type="number" id="editPackPerCarton${index}" value="${item.packPerCarton}" placeholder="باكت/كرتون" class="action-btn" style="width: 80px; margin: 2px;">
                        <input type="number" id="editUnitsPerPack${index}" value="${item.unitsPerPack}" placeholder="حبة/باكت" class="action-btn" style="width: 80px; margin: 2px;">
                    </div>
                `;
             }
             
            tr.innerHTML = `
                <td><input type="text" id="editName${index}" value="${item.name}" class="action-btn"></td>
                <td><input type="number" id="editPriceSale${index}" value="${item.price.toFixed(2)}" class="action-btn"></td>
                <td><input type="number" id="editPricePurchase${index}" value="${item.price_purchase.toFixed(2)}" class="action-btn"></td>
                <td>
                    <input type="number" id="editQty${index}" value="${item.qty}" class="action-btn" style="width: 60px;">
                    <span style="font-size: 0.8em; display: block;">${item.unit}</span>
                    ${conversionInputs}
                </td>
                <td>${total.toFixed(2)}</td>
                <td>${item.lastModified}</td>
                <td>
                    <button onclick="saveItem(${index})" class="action-btn save-btn">حفظ</button>
                    <button onclick="cancelEdit(${index})" class="action-btn delete-btn">إلغاء</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${item.price_purchase.toFixed(2)}</td>
                <td>${qtyDisplay}</td>
                <td>${total.toFixed(2)}</td>
                <td>${item.lastModified}</td>
                <td>
                    <button onclick="editItem(${index})" class="action-btn edit-btn">تعديل</button>
                    <button onclick="deleteItem(${index})" class="action-btn delete-btn">حذف</button>
                </td>
            `;
        }
        tableBody.appendChild(tr);
    });

    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `
        <th colspan="4" style="text-align: right;">المجموع الكلي لقيمة المخزون (شراء)</th>
        <th>${grandTotalValue.toFixed(2)}</th>
        <th colspan="2"></th>
    `;
    tableFoot.appendChild(totalRow);
}

function saveItem(index) {
    const newName = document.getElementById(`editName${index}`).value.trim();
    const newPriceSale = parseFloat(document.getElementById(`editPriceSale${index}`).value);
    const newPricePurchase = parseFloat(document.getElementById(`editPricePurchase${index}`).value);
    const newQty = parseFloat(document.getElementById(`editQty${index}`).value); // Allow float
    
    let newPackPerCarton = items[index].packPerCarton;
    let newUnitsPerPack = items[index].unitsPerPack;
    let newTotalUnits = items[index].totalUnits;
    
    // قراءة حقول التحويل عند التعديل
    if (items[index].unit === 'كرتون') {
        const packPerCartonInput = document.getElementById(`editPackPerCarton${index}`);
        const unitsPerPackInput = document.getElementById(`editUnitsPerPack${index}`);
        
        if (packPerCartonInput && unitsPerPackInput) {
            newPackPerCarton = parseInt(packPerCartonInput.value);
            newUnitsPerPack = parseInt(unitsPerPackInput.value);

            if (isNaN(newPackPerCarton) || isNaN(newUnitsPerPack) || newPackPerCarton <= 0 || newUnitsPerPack <= 0) {
                alert("يرجى تحديد عوامل التحويل (باكت وحبة) بأرقام صحيحة أكبر من صفر.");
                return;
            }
            newTotalUnits = newPackPerCarton * newUnitsPerPack;
        }
    }
    
    if (!newName || isNaN(newPriceSale) || isNaN(newPricePurchase) || isNaN(newQty) || newPriceSale <= 0 || newPricePurchase < 0 || newQty < 0) {
        alert("بيانات التعديل غير صحيحة.");
        return;
    }
    
    // منع سعر البيع الأقل من سعر الشراء عند التعديل
    if (newPriceSale < newPricePurchase) {
        alert("خطأ: سعر البيع يجب أن يكون أكبر من أو يساوي سعر الشراء لتجنب الخسارة المباشرة.");
        return;
    }

    items[index].name = newName;
    items[index].price = newPriceSale;
    items[index].price_purchase = newPricePurchase;
    items[index].qty = newQty;
    items[index].packPerCarton = newPackPerCarton;
    items[index].unitsPerPack = newUnitsPerPack;
    items[index].totalUnits = newTotalUnits;
    items[index].lastModified = new Date().toISOString().split('T')[0]; 
    items[index].isEditing = false;
    editingIndex = -1;

    saveItems();
    renderTable();
    renderInvoiceForm();
}
function editItem(index) {
    if (editingIndex !== -1) {
        alert("يرجى حفظ أو إلغاء تعديل الصنف الحالي أولاً.");
        return;
    }
    items[index].isEditing = true;
    editingIndex = index;
    renderTable();
}

function cancelEdit(index) {
    items[index].isEditing = false;
    editingIndex = -1;
    renderTable();
}

function deleteItem(index) {
    if(confirm('هل أنت متأكد من حذف هذا الصنف من المخزون؟')) {
        items.splice(index, 1);
        saveItems();
        renderTable();
        renderInvoiceForm();
    }
}
// --- وظائف التصدير (Export) ---

function downloadCSV(csv, filename) {
    const csvFile = new Blob(["\ufeff", csv], {type: "text/csv;charset=utf-8;"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(csvFile);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportInventoryToCSV() {
    const inventoryData = items;
    
    let csv = ["اسم الصنف", "سعر البيع", "سعر الشراء", "الكمية", "الوحدة", "باكت/كرتون", "حبة/باكت", "اجمالي الحبات في الوحدة الكبرى", "القيمة الاجمالية للشراء", "تاريخ آخر تعديل"].join(',') + '\n';

    inventoryData.forEach(item => {
        const totalValue = (item.price_purchase * item.qty).toFixed(2);
        csv += [
            `"${item.name}"`, 
            item.price.toFixed(2), 
            item.price_purchase.toFixed(2), 
            item.qty.toFixed(2), 
            `"${item.unit}"`, 
            item.packPerCarton || '0', 
            item.unitsPerPack || '0', 
            item.totalUnits || '0', 
            totalValue, 
            item.lastModified
        ].join(',') + '\n';
    });

    const filename = `Inventory_Report_${todayDate}.csv`;
    downloadCSV(csv, filename);
}
// --- وظائف إدارة العملاء (Customers) - لم تتغير ---

function addCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();

    if (!name) { alert("يرجى إدخال اسم العميل."); return; }
    if (customers.some(c => c.name === name)) { alert("هذا العميل مسجل بالفعل."); return; }

    customers.push({
        name: name,
        phone: phone,
        address: address,
        dateAdded: todayDate
    });

    document.getElementById('customerName').value = document.getElementById('customerPhone').value = document.getElementById('customerAddress').value = '';
    
    saveItems();
    renderCustomersTable();
    renderInvoiceForm();
}

function renderCustomersTable() {
    const tableBody = document.querySelector('#customersTable tbody');
    tableBody.innerHTML = '';

    customers.forEach((customer, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone || '---'}</td>
            <td>${customer.address || '---'}</td>
            <td>${customer.dateAdded}</td>
            <td>
                <button onclick="deleteCustomer(${index})" class="action-btn delete-btn">حذف</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function deleteCustomer(index) {
    if(confirm(`هل أنت متأكد من حذف العميل: ${customers[index].name}؟ لن يؤثر الحذف على الفواتير السابقة.`)) {
        customers.splice(index, 1);
        saveItems();
        renderCustomersTable();
        renderInvoiceForm();
    }
}


// --- وظائف إنشاء الفاتورة (Invoice) ---

function calculateInvoiceTotals(invoiceItems, discountPercentage, vatRate) {
    // 1. حساب الإجمالي الفرعي قبل أي خصم
    let subTotalBeforeDiscount = invoiceItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    // 6. تكلفة البضاعة المباعة (COGS)
    // الآن يتم تخزين price_purchase في كل صنف كـ COGS لوحدة البيع (sellUnit)
    let cogs = invoiceItems.reduce((sum, item) => sum + (item.price_purchase * item.qty), 0);

    // 2. حساب الخصم
    const discountAmount = subTotalBeforeDiscount * (discountPercentage / 100);
    
    // 3. الإجمالي بعد الخصم (وهو نفسه الإيراد قبل الضريبة)
    const revenueBeforeTax = subTotalBeforeDiscount - discountAmount;
    
    // 4. حساب الضريبة
    const vatAmount = revenueBeforeTax * (vatRate / 100);
    
    // 5. الإجمالي النهائي (شامل الضريبة والخصم)
    const grandTotal = revenueBeforeTax + vatAmount;

    return { 
        subTotal: subTotalBeforeDiscount, 
        discountAmount, 
        revenueBeforeTax, 
        vatAmount, 
        grandTotal, 
        cogs 
    };
}

// دالة جديدة لتحديث خيارات وحدة البيع عند اختيار صنف
function populateSellUnits() {
    const selectElement = document.getElementById('invoiceItemSelect');
    const unitSelect = document.getElementById('invoiceSellUnit');
    const selectedIndex = selectElement.value;
    
    unitSelect.innerHTML = '<option value="">الوحدة</option>';

    if (selectedIndex === "") { return; }

    const item = items[selectedIndex];
    
    // الوحدة الرئيسية (دائماً متاحة)
    unitSelect.innerHTML += `<option value="${item.unit}">${item.unit}</option>`;

    // إذا كانت الوحدة الرئيسية كرتون، نضيف خيارات البيع بالتجزئة
    if (item.unit === "كرتون" && item.packPerCarton > 0 && item.unitsPerPack > 0) {
        unitSelect.innerHTML += `<option value="باكت">باكت</option>`;
        unitSelect.innerHTML += `<option value="حبة">حبة</option>`;
    } 
    // إذا كانت الوحدة الرئيسية باكت، نضيف خيار البيع بالحبة (افتراضياً)
    else if (item.unit === "باكت" && item.unitsPerPack > 0) {
        unitSelect.innerHTML += `<option value="حبة">حبة</option>`;
    }
    
    unitSelect.value = item.unit; // تحديد الوحدة الرئيسية كخيار افتراضي
}

function renderInvoiceForm() {
    // تحديث قائمة الأصناف
    const selectElement = document.getElementById('invoiceItemSelect');
    selectElement.innerHTML = '<option value="">اختر صنف للبيع</option>';
    items.forEach((item, index) => {
        if (item.qty > 0) {
            // عرض عوامل التحويل في قائمة الاختيار
            let qtyDisplay = `${item.qty.toFixed(2)} ${item.unit}`;
            if (item.unit === 'كرتون' && item.totalUnits > 0) {
                 qtyDisplay = `${item.qty.toFixed(2)} ${item.unit} (${item.packPerCarton}x${item.unitsPerPack} حبة)`;
            } else if (item.unit === 'باكت' && item.unitsPerPack > 0) {
                 qtyDisplay = `${item.qty.toFixed(2)} ${item.unit} (${item.unitsPerPack} حبة)`;
            }

            const option = document.createElement('option');
            option.value = index; 
            option.textContent = `${item.name} (المخزون: ${qtyDisplay}، السعر: ${item.price.toFixed(2)})`;
            selectElement.appendChild(option);
        }
    });

    // تحديث قائمة العملاء
    const clientSelect = document.getElementById('clientNameSelect');
    clientSelect.innerHTML = '<option value="نقد">عميل نقدي</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.name;
        option.textContent = customer.name;
        clientSelect.appendChild(option);
    });

    populateSellUnits(); // تحديث خيارات وحدة البيع
    checkClientStatus();
}

function checkClientStatus() {
    const clientName = document.getElementById('clientNameSelect').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    
    const isRegisteredClient = customers.some(c => c.name === clientName);

    if (paymentStatus === 'آجل' && clientName === 'نقد') {
        alert("لا يمكن إصدار فاتورة آجلة لـ 'عميل نقدي'. يرجى اختيار عميل مسجل أو تغيير حالة الدفع.");
        document.getElementById('paymentStatus').value = 'نقد'; 
    }
}

function addItemToInvoice() {
    const selectedIndex = document.getElementById('invoiceItemSelect').value;
    const sellUnit = document.getElementById('invoiceSellUnit').value;
    const qtyRequested = parseFloat(document.getElementById('invoiceItemQty').value); // Allow float quantity
    
    if (selectedIndex === "" || isNaN(qtyRequested) || qtyRequested <= 0 || sellUnit === "") {
        alert("يرجى اختيار صنف ووحدة بيع وإدخال كمية صحيحة (أكبر من صفر).");
        return;
    }

    const inventoryItem = items[selectedIndex];
    
    // --- 1. حساب السعر وتكلفة البضاعة المباعة (COGS) لكل وحدة بيع (sellUnit) ---
    let pricePerSellUnit = inventoryItem.price; 
    let cogsPerSellUnit = inventoryItem.price_purchase; 
    let smallestUnitsPerSellUnit = 1; // كم حبة في وحدة البيع

    if (inventoryItem.unit === "كرتون" && inventoryItem.totalUnits > 0) {
        // سعر بيع وشراء الحبة الواحدة
        const unitPricePerSmallest = inventoryItem.price / inventoryItem.totalUnits; 
        const cogsPerSmallest = inventoryItem.price_purchase / inventoryItem.totalUnits; 

        if (sellUnit === "باكت") {
            smallestUnitsPerSellUnit = inventoryItem.unitsPerPack;
            pricePerSellUnit = unitPricePerSmallest * smallestUnitsPerSellUnit;
            cogsPerSellUnit = cogsPerSmallest * smallestUnitsPerSellUnit;
        } else if (sellUnit === "حبة") {
            smallestUnitsPerSellUnit = 1;
            pricePerSellUnit = unitPricePerSmallest;
            cogsPerSellUnit = cogsPerSmallest;
        } else if (sellUnit === "كرتون") {
            smallestUnitsPerSellUnit = inventoryItem.totalUnits;
            // pricePerSellUnit and cogsPerSellUnit are already set to the full carton price.
        }
    } 
    // ملاحظة: يمكن إضافة منطق لوحدة 'باكت' كوحدة مخزون رئيسية هنا إذا كان هناك حاجة للبيع بـ 'حبة'
    
    // --- 2. حساب إجمالي الكمية المطلوبة بالوحدة الصغرى (الحبة) للتحقق من المخزون ---
    
    // إجمالي الكمية المتوفرة في المخزون (بالحبة)
    const totalUnitsInStock = (inventoryItem.qty * (inventoryItem.totalUnits || 1));
    
    // كمية الإضافة الجديدة (بالحبة)
    const newQtyInSmallestUnit = qtyRequested * smallestUnitsPerSellUnit;

    // كمية الصنف الموجودة حاليًا في الفاتورة (بالحبة)
    let existingQtyInSmallestUnit = 0;
    
    currentInvoiceItems.forEach(item => {
        if (item.inventoryIndex === parseInt(selectedIndex)) {
            let smallestUnitsPerLineItemUnit = 1;
            if (item.unit === "كرتون" && item.totalUnits > 0) {
                 if (item.sellUnit === "كرتون") {
                    smallestUnitsPerLineItemUnit = item.totalUnits;
                } else if (item.sellUnit === "باكت") {
                    smallestUnitsPerLineItemUnit = item.unitsPerPack;
                } else if (item.sellUnit === "حبة") {
                    smallestUnitsPerLineItemUnit = 1;
                }
            }
            // إذا كانت وحدة التخزين الرئيسية ليست كرتون، نفترض أن أصغر وحدة هي الوحدة نفسها
            existingQtyInSmallestUnit += item.qty * smallestUnitsPerLineItemUnit;
        }
    });
    
    const grandTotalUnitsRequested = newQtyInSmallestUnit + existingQtyInSmallestUnit;

    // --- 3. التحقق من المخزون ---
    if (grandTotalUnitsRequested > totalUnitsInStock) {
        alert(`إجمالي الكمية المطلوبة (${grandTotalUnitsRequested.toFixed(2)} حبة) تفوق المتوفر في المخزون (${totalUnitsInStock.toFixed(2)} حبة). يرجى تقليل الكمية.`);
        return;
    }

    // --- 4. الإضافة/التحديث في الفاتورة ---
    
    // تحقق مما إذا كان هناك صنف موجود بنفس الصنف ونفس وحدة البيع
    let existingLineItem = currentInvoiceItems.find(item => 
        item.inventoryIndex === parseInt(selectedIndex) && 
        item.sellUnit === sellUnit
    );
    
    if (existingLineItem) {
        existingLineItem.qty += qtyRequested;
    } else {
         currentInvoiceItems.push({
            name: inventoryItem.name,
            price: pricePerSellUnit, // سعر بيع الوحدة المختارة
            price_purchase: cogsPerSellUnit, // تكلفة شراء الوحدة المختارة
            qty: qtyRequested, // الكمية بالوحدة المختارة للبيع
            unit: inventoryItem.unit, // وحدة المخزون (كرتون/باكت...)
            sellUnit: sellUnit, // الوحدة التي تم البيع بها (كرتون/باكت/حبة)
            packPerCarton: inventoryItem.packPerCarton, 
            unitsPerPack: inventoryItem.unitsPerPack,
            totalUnits: inventoryItem.totalUnits, 
            inventoryIndex: parseInt(selectedIndex) 
        });
    }

    // --- 5. التنظيف والعرض ---
    document.getElementById('invoiceItemQty').value = '';
    renderCurrentInvoiceItemsTable();
    renderInvoiceForm();
}

function renderCurrentInvoiceItemsTable() {
    const tableBody = document.querySelector('#currentInvoiceTable tbody');
    const tableFoot = document.getElementById('currentInvoiceTotal');
    
    tableBody.innerHTML = '';
    tableFoot.innerHTML = '';

    currentInvoiceItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        const itemTotal = item.price * item.qty;
        
        // **منطق العرض الجديد**
        let unitDetails = '';
        if (item.unit === 'كرتون' && item.sellUnit !== 'كرتون' && item.totalUnits > 0) {
            unitDetails = ` (من مخزون الكرتون)`;
        }

        const qtyDisplay = `${item.qty.toFixed(2)} ${item.sellUnit} ${unitDetails}`;
        // **نهاية منطق العرض الجديد**

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.price.toFixed(2)} / ${item.sellUnit}</td>
            <td>${qtyDisplay}</td>
            <td>${itemTotal.toFixed(2)}</td>
            <td>
                <button onclick="deleteItemFromInvoice(${index})" class="delete-btn action-btn">X</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    const discountPercentage = parseFloat(document.getElementById('invoiceDiscount').value) || 0;
    const vatRate = parseFloat(document.getElementById('vatRate').value) || 0;
    
    const { subTotal, discountAmount, revenueBeforeTax, vatAmount, grandTotal } = calculateInvoiceTotals(currentInvoiceItems, discountPercentage, vatRate);

    tableFoot.innerHTML = `
        <tr><th colspan="3" style="text-align: right;">الإجمالي الفرعي:</th><th>${subTotal.toFixed(2)}</th><th></th></tr>
        <tr><th colspan="3" style="text-align: right;">الخصم (${discountPercentage.toFixed(2)}%):</th><th>${discountAmount.toFixed(2)}</th><th></th></tr>
        <tr><th colspan="3" style="text-align: right;">الإجمالي قبل الضريبة:</th><th>${revenueBeforeTax.toFixed(2)}</th><th></th></tr>
        <tr><th colspan="3" style="text-align: right;">الضريبة المضافة (${vatRate.toFixed(2)}%):</th><th>${vatAmount.toFixed(2)}</th><th></th></tr>
        <tr style="background-color: #d4edda; font-weight: bold;"><th colspan="3" style="text-align: right;">الإجمالي النهائي (شامل):</th><th>${grandTotal.toFixed(2)}</th><th></th></tr>
    `;
}

function deleteItemFromInvoice(index) {
    currentInvoiceItems.splice(index, 1);
    renderCurrentInvoiceItemsTable();
}

function finalizeInvoice() {
    if (currentInvoiceItems.length === 0) {
        alert("لا يمكن إصدار فاتورة فارغة. يرجى إضافة أصناف أولاً.");
        return;
    }

    const clientName = document.getElementById('clientNameSelect').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    const invoiceDate = document.getElementById('invoiceDate').value;
    const discountPercentage = parseFloat(document.getElementById('invoiceDiscount').value) || 0;
    const vatRate = parseFloat(document.getElementById('vatRate').value) || 0;

    if (paymentStatus === 'آجل' && clientName === 'نقد') {
        alert("خطأ: لا يمكن إصدار فاتورة آجلة لـ 'عميل نقدي'.");
        return;
    }
    
    const { subTotal, grandTotal, cogs, revenueBeforeTax, vatAmount } = calculateInvoiceTotals(currentInvoiceItems, discountPercentage, vatRate);

    // **منطق خصم الكمية الجديد (بالتحويل إلى وحدة المخزون الرئيسية)**
    currentInvoiceItems.forEach(soldItem => {
        const invIndex = soldItem.inventoryIndex;
        const inventoryItem = items[invIndex];
        
        if (inventoryItem && inventoryItem.name === soldItem.name) {
            let reductionInInventoryUnits = soldItem.qty; 
            
            // حساب الخصم إذا كانت وحدة المخزون هي 'كرتون'
            if (inventoryItem.unit === "كرتون" && inventoryItem.totalUnits > 0) {
                let smallestUnitsPerSellUnit = 1;
                
                if (soldItem.sellUnit === "كرتون") {
                    smallestUnitsPerSellUnit = inventoryItem.totalUnits;
                } else if (soldItem.sellUnit === "باكت") {
                    smallestUnitsPerSellUnit = inventoryItem.unitsPerPack;
                } else if (soldItem.sellUnit === "حبة") {
                    smallestUnitsPerSellUnit = 1;
                }
                
                // إجمالي ما تم بيعه بالحبة
                const totalSoldInSmallestUnit = soldItem.qty * smallestUnitsPerSellUnit;
                
                // تحويل المبيعات بالحبة إلى كمية المخزون (الكرتون)
                reductionInInventoryUnits = totalSoldInSmallestUnit / inventoryItem.totalUnits;
            } 
            
            // خصم الكمية (قد تكون كسرية)
            inventoryItem.qty -= reductionInInventoryUnits;
            inventoryItem.lastModified = todayDate;
        }
    });
    // **نهاية منطق خصم الكمية الجديد**

    const newInvoice = {
        id: invoiceCounter,
        date: invoiceDate,
        client: clientName === 'نقد' ? 'عميل نقدي' : clientName,
        paymentStatus: paymentStatus,
        discount: discountPercentage,
        vatRate: vatRate,
        vatAmount: vatAmount,
        subTotal: subTotal,
        revenueBeforeTax: revenueBeforeTax,
        grandTotal: grandTotal,
        cogs: cogs,
        items: JSON.parse(JSON.stringify(currentInvoiceItems)) 
    };

    invoices.push(newInvoice);
    invoiceCounter++;

    currentInvoiceItems = [];
    document.getElementById('clientNameSelect').value = 'نقد';
    document.getElementById('paymentStatus').value = 'نقد';
    document.getElementById('invoiceDiscount').value = '0';
    document.getElementById('invoiceDate').value = todayDate;
    
    saveItems();
    renderTable(); 
    renderInvoiceForm(); 
    renderInvoicesList(); 
    alert(`تم إصدار الفاتورة رقم ${newInvoice.id} بنجاح! الإجمالي: ${grandTotal.toFixed(2)}`);
}

function renderInvoicesList() {
    const tableBody = document.querySelector('#invoicesListTable tbody');
    tableBody.innerHTML = '';
    
    const invoicesSearchText = document.getElementById('invoicesSearch').value.toLowerCase(); 

    const filteredInvoices = invoices.filter(invoice => {
        const matchID = invoice.id.toString().includes(invoicesSearchText);
        const matchClient = invoice.client.toLowerCase().includes(invoicesSearchText);
        const matchTotal = invoice.grandTotal.toFixed(2).includes(invoicesSearchText);
        const matchStatus = invoice.paymentStatus.toLowerCase().includes(invoicesSearchText);
        return matchID || matchClient || matchTotal || matchStatus;
    }).slice().reverse(); 

    filteredInvoices.forEach(invoice => {
        const tr = document.createElement('tr');
        const statusColor = invoice.paymentStatus === 'آجل' ? '#ffc107' : '#28a745';
        const statusText = invoice.paymentStatus === 'آجل' ? 'آجل 🟡' : 'نقد 🟢';

        tr.innerHTML = `
            <td>${invoice.id}</td>
            <td>${invoice.date}</td>
            <td>${invoice.client}</td>
            <td style="background-color: ${statusColor}; color: #343a40; font-weight: bold;">${statusText}</td>
            <td>${invoice.grandTotal.toFixed(2)}</td>
            <td>
                <button onclick="viewInvoiceDetails(${invoice.id})" class="action-btn" style="background-color: #17a2b8;">عرض</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function viewInvoiceDetails(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        let details = `\n--- تفاصيل الفاتورة رقم ${invoice.id} ---\n`;
        details += `التاريخ: ${invoice.date}\n`;
        details += `العميل: ${invoice.client}\n`;
        details += `حالة الدفع: ${invoice.paymentStatus}\n`;
        details += `الإجمالي الفرعي: ${invoice.subTotal.toFixed(2)}\n`;
        details += `الخصم (${invoice.discount}%): ${(invoice.subTotal - invoice.revenueBeforeTax).toFixed(2)}\n`;
        details += `الإجمالي قبل الضريبة: ${invoice.revenueBeforeTax.toFixed(2)}\n`;
        details += `قيمة الضريبة (${invoice.vatRate}%): ${invoice.vatAmount.toFixed(2)}\n`;
        details += `الإجمالي النهائي: ${invoice.grandTotal.toFixed(2)}\n`;
        details += `تكلفة البضاعة المباعة (COGS): ${invoice.cogs.toFixed(2)}\n`;
        details += `صافي الربح الإجمالي: ${(invoice.revenueBeforeTax - invoice.cogs).toFixed(2)}\n`;
        details += "\n** الأصناف المباعة **\n";
        
        invoice.items.forEach(item => {
            let unitDetails = '';
            if (item.unit === 'كرتون' && item.sellUnit !== 'كرتون' && item.totalUnits > 0) {
                 unitDetails = ` (من مخزون الكرتون)`;
            }
            details += `- ${item.name} (${item.qty.toFixed(2)} ${item.sellUnit}${unitDetails}) @ ${item.price.toFixed(2)} = ${(item.price * item.qty).toFixed(2)}\n`;
        });
        
        alert(details);
    }
}

// --- وظائف جرد المخزون (Physical Count) ---

function renderPhysicalCountTable() {
    const tableBody = document.querySelector('#physicalCountTable tbody');
    tableBody.innerHTML = '';
    
    const countSearchText = document.getElementById('countSearch').value.toLowerCase();
    
    items.forEach((item, index) => {
        const isMatch = item.name.toLowerCase().includes(countSearchText);
        
        if (countSearchText && !isMatch) {
            return;
        }

        const tr = document.createElement('tr');
        
        // حساب إجمالي الحبات في الوحدة الكبرى للعرض
        const totalUnitsInSmallestUnit = (item.qty * (item.totalUnits || 1));
        let unitDisplay = item.unit;
        if (item.unit === 'كرتون' && item.totalUnits > 0) {
            unitDisplay = `${item.unit} (${item.totalUnits} حبة/كرتون)`;
        } else if (item.unit === 'باكت' && item.unitsPerPack > 0) {
             unitDisplay = `${item.unit} (${item.unitsPerPack} حبة/باكت)`;
        }

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${unitDisplay}</td>
            <td id="systemQty${index}">${item.qty.toFixed(2)}</td>
            <td>
                <input type="number" step="any" id="physicalQty${index}" 
                       value="${item.qty.toFixed(2)}" 
                       min="0" class="action-btn" style="width: 100px;" 
                       oninput="calculateDifference(${index})">
            </td>
            <td id="difference${index}">0.00</td>
        `;
        tableBody.appendChild(tr);
        
        // قم بإجراء الحساب الأولي عند عرض الجدول
        calculateDifference(index);
    });
}

function calculateDifference(index) {
    const systemQtyElement = document.getElementById(`systemQty${index}`);
    const physicalQtyInput = document.getElementById(`physicalQty${index}`);
    const differenceElement = document.getElementById(`difference${index}`);
    
    const systemQty = parseFloat(systemQtyElement.textContent);
    const physicalQty = parseFloat(physicalQtyInput.value);
    
    if (isNaN(physicalQty)) {
        differenceElement.textContent = "يرجى الإدخال";
        differenceElement.style.backgroundColor = 'transparent';
        differenceElement.style.color = '#333';
        return;
    }
    
    const difference = physicalQty - systemQty;
    
    differenceElement.textContent = difference.toFixed(2);
    
    if (difference > 0) {
        // فائض
        differenceElement.style.backgroundColor = '#d4edda'; // أخضر فاتح
        differenceElement.style.color = '#155724';
    } else if (difference < 0) {
        // عجز
        differenceElement.style.backgroundColor = '#f8d7da'; // أحمر فاتح
        differenceElement.style.color = '#721c24';
    } else {
        // متطابق
        differenceElement.style.backgroundColor = '#f0f0f0';
        differenceElement.style.color = '#333';
    }
}

function updateInventoryAfterCount() {
    let countConfirmed = 0;
    
    items.forEach((item, index) => {
        const physicalQtyInput = document.getElementById(`physicalQty${index}`);
        if (physicalQtyInput) {
            const newQty = parseFloat(physicalQtyInput.value);
            
            if (!isNaN(newQty) && parseFloat(newQty.toFixed(2)) !== parseFloat(item.qty.toFixed(2))) { // مقارنة بعد التقريب لتجنب أخطاء الفاصلة العائمة
                // تحديث كمية الصنف بكمية الجرد الجديدة
                item.qty = newQty;
                item.lastModified = todayDate;
                countConfirmed++;
            }
        }
    });

    if (countConfirmed > 0) {
        saveItems();
        renderTable(); 
        renderInvoiceForm();
        renderPhysicalCountTable();
        alert(`تم تحديث مخزون ${countConfirmed} صنف بناءً على الجرد الفعلي بنجاح!`);
    } else {
        alert("لا توجد أصناف تم تعديل كميتها أو لم يتم إدخال قيمة صحيحة.");
    }
}

// --- وظائف التقارير (Reports) ---
function renderReports() {
    const fromDateStr = document.getElementById('reportFromDate').value;
    const toDateStr = document.getElementById('reportToDate').value;

    let filteredInvoices = invoices;

    // تطبيق التصفية الزمنية
    if (fromDateStr || toDateStr) {
        const fromDate = fromDateStr ? new Date(fromDateStr) : null;
        const toDate = toDateStr ? new Date(toDateStr) : null;

        filteredInvoices = invoices.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            let isAfterFrom = fromDate ? (invoiceDate >= fromDate) : true;
            let isBeforeTo = toDate ? (invoiceDate <= toDate) : true;

            return isAfterFrom && isBeforeTo;
        });
    }

    let totalRevenueBeforeTax = 0;
    let totalCogs = 0;
    let totalDiscounts = 0;
    let totalVAT = 0;
    const dailySales = {}; 

    filteredInvoices.forEach(invoice => {
        totalRevenueBeforeTax += invoice.revenueBeforeTax;
        totalCogs += invoice.cogs;
        totalVAT += invoice.vatAmount;

        const discountAmount = invoice.subTotal - invoice.revenueBeforeTax;
        totalDiscounts += discountAmount;

        const date = invoice.date;
        if (!dailySales[date]) {
            dailySales[date] = { revenue: 0, cogs: 0, grandTotal: 0 };
        }
        dailySales[date].revenue += invoice.revenueBeforeTax;
        dailySales[date].cogs += invoice.cogs;
        dailySales[date].grandTotal += invoice.grandTotal;
    });

    const netProfit = totalRevenueBeforeTax - totalCogs;
    
    document.getElementById('totalRevenueBeforeTax').textContent = totalRevenueBeforeTax.toFixed(2);
    document.getElementById('totalVAT').textContent = totalVAT.toFixed(2);
    document.getElementById('totalDiscounts').textContent = totalDiscounts.toFixed(2);
    document.getElementById('totalCogs').textContent = totalCogs.toFixed(2);
    document.getElementById('netProfit').textContent = netProfit.toFixed(2);

    const profitElement = document.getElementById('netProfit');
    profitElement.parentNode.style.backgroundColor = netProfit >= 0 ? '#d4edda' : '#f8d7da';
    profitElement.style.color = netProfit >= 0 ? '#155724' : '#721c24';

    const dailySalesBody = document.querySelector('#dailySalesTable tbody');
    dailySalesBody.innerHTML = '';

    const sortedDates = Object.keys(dailySales).sort().reverse();

    sortedDates.forEach(date => {
        const tr = document.createElement('tr');
        const dailyProfit = dailySales[date].revenue - dailySales[date].cogs;

        tr.innerHTML = `
            <td>${date}</td>
            <td>${dailySales[date].grandTotal.toFixed(2)}</td>
            <td style="color: ${dailyProfit >= 0 ? 'green' : 'red'}; font-weight: bold;">
                ${dailyProfit.toFixed(2)}
            </td>
        `;
        dailySalesBody.appendChild(tr);
    });
}
