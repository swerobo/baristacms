import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  CheckIcon,
  XMarkIcon,
  EnvelopeIcon,
  PrinterIcon,
  ArrowUturnRightIcon,
  HomeIcon,
  UsersIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  Squares2X2Icon,
  UserGroupIcon,
  TruckIcon,
  BeakerIcon,
  WrenchIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  StarIcon,
  HeartIcon,
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftIcon,
  CloudIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  KeyIcon,
  LightBulbIcon,
  MusicalNoteIcon,
  PaperClipIcon,
  ShoppingCartIcon,
  TicketIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HomeIcon,
  CubeIcon,
  UsersIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  WrenchIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  Squares2X2Icon,
  TruckIcon,
  BeakerIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  StarIcon,
  HeartIcon,
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftIcon,
  CloudIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  KeyIcon,
  LightBulbIcon,
  MusicalNoteIcon,
  PaperClipIcon,
  ShoppingCartIcon,
  TicketIcon,
  VideoCameraIcon,
};

// Get icon component by name
const getIcon = (iconName?: string): React.ComponentType<{ className?: string }> | null => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return null;
};

const iconOptions = [
  { value: '', label: 'None (default cube)' },
  { value: 'CubeIcon', label: 'Cube' },
  { value: 'HomeIcon', label: 'Home' },
  { value: 'UsersIcon', label: 'Users' },
  { value: 'UserGroupIcon', label: 'User Group' },
  { value: 'BuildingOffice2Icon', label: 'Building' },
  { value: 'TruckIcon', label: 'Truck/Delivery' },
  { value: 'BeakerIcon', label: 'Beaker/Lab' },
  { value: 'WrenchIcon', label: 'Wrench/Tool' },
  { value: 'WrenchScrewdriverIcon', label: 'Tools' },
  { value: 'ComputerDesktopIcon', label: 'Computer' },
  { value: 'PhoneIcon', label: 'Phone' },
  { value: 'DocumentTextIcon', label: 'Document' },
  { value: 'ClipboardDocumentListIcon', label: 'Clipboard' },
  { value: 'FolderIcon', label: 'Folder' },
  { value: 'ArchiveBoxIcon', label: 'Archive' },
  { value: 'InboxIcon', label: 'Inbox' },
  { value: 'CalendarIcon', label: 'Calendar' },
  { value: 'ClockIcon', label: 'Clock' },
  { value: 'ChartBarIcon', label: 'Chart' },
  { value: 'TagIcon', label: 'Tag' },
  { value: 'MapPinIcon', label: 'Location' },
  { value: 'Cog6ToothIcon', label: 'Settings' },
  { value: 'ShieldCheckIcon', label: 'Shield' },
  { value: 'KeyIcon', label: 'Key' },
  { value: 'Squares2X2Icon', label: 'Grid' },
  { value: 'StarIcon', label: 'Star' },
  { value: 'HeartIcon', label: 'Heart' },
  { value: 'BellIcon', label: 'Bell' },
  { value: 'BookOpenIcon', label: 'Book' },
  { value: 'BriefcaseIcon', label: 'Briefcase' },
  { value: 'CameraIcon', label: 'Camera' },
  { value: 'ChatBubbleLeftIcon', label: 'Chat' },
  { value: 'CloudIcon', label: 'Cloud' },
  { value: 'CurrencyDollarIcon', label: 'Currency' },
  { value: 'GlobeAltIcon', label: 'Globe' },
  { value: 'LightBulbIcon', label: 'Light Bulb' },
  { value: 'MusicalNoteIcon', label: 'Music' },
  { value: 'PaperClipIcon', label: 'Attachment' },
  { value: 'ShoppingCartIcon', label: 'Shopping Cart' },
  { value: 'TicketIcon', label: 'Ticket' },
  { value: 'VideoCameraIcon', label: 'Video' },
];
import {
  moduleService,
  menuService,
  type Module,
  type MenuItem,
  type FieldType,
  type ModuleConfig,
  type DateWarningMode,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select/Dropdown' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'relation', label: 'Relation (Link to Module)' },
  { value: 'user', label: 'User (Lookup from Users)' },
];

interface FieldFormData {
  name: string;
  displayName: string;
  fieldType: FieldType;
  isRequired: boolean;
  options: string;
  defaultValue: string;
  relationModule: string;  // For relation fields: which module to link to
  warningYellowDays: string;  // For date fields: days before date for yellow warning
  warningRedDays: string;     // For date fields: days before date for red warning
  warningMode: DateWarningMode; // For date fields: 'overdue' (deadline) or 'predate' (start date)
  weight: string;  // Weight for sorting (1-99, lower = first)
}

const emptyField: FieldFormData = {
  name: '',
  displayName: '',
  fieldType: 'text',
  isRequired: false,
  options: '',
  defaultValue: '',
  relationModule: '',
  warningYellowDays: '',
  warningRedDays: '',
  warningMode: 'overdue',
  weight: '50',
};

export default function ModulesPage() {
  const { showToast } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [statuses, setStatuses] = useState('active, inactive');
  const [defaultStatus, setDefaultStatus] = useState('active');
  const [features, setFeatures] = useState('images, documents, history, links');
  const [enableEmail, setEnableEmail] = useState(false);
  const [enableLabelPrint, setEnableLabelPrint] = useState(false);
  const [enableEmailInbox, setEnableEmailInbox] = useState(false);
  const [autoProcessEmails, setAutoProcessEmails] = useState(false);
  const [useInApp, setUseInApp] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [parentModuleId, setParentModuleId] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldFormData[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [modulesData, menuData] = await Promise.all([
        moduleService.getAll(),
        menuService.getAll(),
      ]);
      setModules(modulesData);
      setMenuItems(menuData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedModule(null);
    setName('');
    setDisplayName('');
    setDescription('');
    setIcon('');
    setStatuses('active, inactive');
    setDefaultStatus('active');
    setFeatures('images, documents, history, links');
    setEnableEmail(false);
    setEnableLabelPrint(false);
    setEnableEmailInbox(false);
    setAutoProcessEmails(false);
    setUseInApp(false);
    setMenuId(null);
    setParentModuleId(null);
    setFields([{ ...emptyField }]);
    setShowModal(true);
  };

  const openEditModal = async (module: Module) => {
    try {
      const fullModule = await moduleService.getByName(module.name);
      setSelectedModule(fullModule);
      setName(fullModule.name);
      setDisplayName(fullModule.display_name);
      setDescription(fullModule.description || '');
      setIcon(fullModule.icon || '');
      setStatuses(fullModule.config?.statuses?.join(', ') || 'active, inactive');
      setDefaultStatus(fullModule.config?.defaultStatus || 'active');
      setFeatures(fullModule.config?.features?.join(', ') || '');
      setEnableEmail(fullModule.config?.enableEmail || false);
      setEnableLabelPrint(fullModule.config?.enableLabelPrint || false);
      setEnableEmailInbox(fullModule.config?.enableEmailInbox || false);
      setAutoProcessEmails(fullModule.config?.autoProcessEmails || false);
      setUseInApp(fullModule.use_in_app === 1);
      setMenuId(fullModule.menu_id || null);
      setParentModuleId(fullModule.parent_module_id || null);
      setFields(
        fullModule.fields?.map((f) => ({
          name: f.name,
          displayName: f.display_name,
          fieldType: f.field_type,
          isRequired: f.is_required === 1,
          options: f.options?.join(', ') || '',
          defaultValue: f.default_value || '',
          relationModule: f.relation_module || '',
          warningYellowDays: f.warning_yellow_days?.toString() || '',
          warningRedDays: f.warning_red_days?.toString() || '',
          warningMode: f.warning_mode || 'overdue',
          weight: f.weight?.toString() || '50',
        })) || []
      );
      setShowModal(true);
    } catch (error) {
      console.error('Failed to load module:', error);
    }
  };

  const addField = () => {
    setFields([...fields, { ...emptyField }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldFormData>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      const config: ModuleConfig = {
        statuses: statuses.split(',').map((s) => s.trim()).filter(Boolean),
        defaultStatus: defaultStatus.trim(),
        features: features.split(',').map((s) => s.trim()).filter(Boolean),
        enableEmail,
        enableLabelPrint,
        enableEmailInbox,
        autoProcessEmails,
      };

      const processedFields = fields
        .filter((f) => f.name && f.displayName)
        .map((f, index) => ({
          name: f.name.toLowerCase().replace(/\s+/g, '_'),
          displayName: f.displayName,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: f.options ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
          defaultValue: f.defaultValue || undefined,
          relationModule: f.fieldType === 'relation' ? f.relationModule : undefined,
          warningYellowDays: f.fieldType === 'date' && f.warningYellowDays ? parseInt(f.warningYellowDays) : undefined,
          warningRedDays: f.fieldType === 'date' && f.warningRedDays ? parseInt(f.warningRedDays) : undefined,
          warningMode: f.fieldType === 'date' ? f.warningMode : undefined,
          sortOrder: index,
          weight: f.weight ? parseInt(f.weight) : 50,
        }));

      if (selectedModule) {
        // Update existing module
        await moduleService.update(selectedModule.name, {
          displayName,
          description: description || undefined,
          icon: icon || undefined,
          config,
          menuId,
          parentModuleId,
          useInApp,
          fields: processedFields,
        });
      } else {
        // Create new module
        await moduleService.create({
          name: name.toLowerCase().replace(/\s+/g, '_'),
          displayName,
          description: description || undefined,
          icon: icon || undefined,
          config,
          menuId,
          parentModuleId,
          fields: processedFields,
        });
      }

      await loadData();
      setShowModal(false);
      showToast(selectedModule ? 'Module updated successfully' : 'Module created successfully', 'success');
    } catch (error) {
      console.error('Failed to save module:', error);
      showToast('Failed to save module', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper to get menu item name by id
  const getMenuItemName = (id: number | null | undefined) => {
    if (!id) return null;
    const item = menuItems.find(m => m.id === id);
    return item?.display_name || null;
  };

  // Build hierarchical menu options for dropdown
  const getMenuOptions = () => {
    const parents = menuItems.filter(item => !item.parent_id);
    const options: { id: number; label: string }[] = [];

    parents.forEach(parent => {
      options.push({ id: parent.id, label: parent.display_name });
      const children = menuItems.filter(item => item.parent_id === parent.id);
      children.forEach(child => {
        options.push({ id: child.id, label: `└─ ${child.display_name}` });
      });
    });

    return options;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Modules</h1>
          <p className="text-gray-500 mt-1">Manage your application modules and their fields.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Module
        </button>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <div
            key={module.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  {(() => {
                    const IconComponent = getIcon(module.icon) || CubeIcon;
                    return <IconComponent className="h-6 w-6 text-blue-600" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{module.display_name}</h3>
                  <p className="text-sm text-gray-500">{module.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(module)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {module.description && (
              <p className="text-sm text-gray-600 mb-4">{module.description}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {module.config?.features?.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                >
                  {feature}
                </span>
              ))}
            </div>

            {/* Module capabilities indicators */}
            {(module.config?.enableEmailInbox || module.config?.enableLabelPrint || module.parent_module_id) && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {module.config?.enableEmailInbox && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                    title="Email Inbox enabled"
                  >
                    <EnvelopeIcon className="h-3 w-3" />
                    Email
                  </span>
                )}
                {module.config?.enableLabelPrint && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700"
                    title="Label printing enabled"
                  >
                    <PrinterIcon className="h-3 w-3" />
                    Print
                  </span>
                )}
                {module.parent_module_id && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700"
                  >
                    <ArrowUturnRightIcon className="h-3 w-3" />
                    Sub-module of {modules.find(m => m.id === module.parent_module_id)?.display_name || 'Unknown'}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {module.menu_id && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Menu:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                    {getMenuItemName(module.menu_id)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Statuses:</span>
                <div className="flex flex-wrap gap-1">
                  {module.config?.statuses?.slice(0, 3).map((status) => (
                    <span
                      key={status}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                    >
                      {status}
                    </span>
                  ))}
                  {(module.config?.statuses?.length || 0) > 3 && (
                    <span className="text-xs text-gray-400">
                      +{(module.config?.statuses?.length || 0) - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {modules.length === 0 && (
          <div className="col-span-full text-center py-12">
            <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No modules yet</p>
            <p className="text-sm text-gray-400">Create your first module to get started</p>
          </div>
        )}
      </div>

      {/* Create/Edit Module Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                {selectedModule ? `Edit Module: ${selectedModule.display_name}` : 'Create New Module'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Basic Info */}
              <div className="space-y-4 mb-6">
                <h3 className="font-medium text-gray-900">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name (slug) *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., visitors"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      required
                      disabled={!!selectedModule}
                    />
                    {selectedModule && (
                      <p className="text-xs text-gray-500 mt-1">Name cannot be changed after creation</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Visitors"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this module for?"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                      {(() => {
                        const IconComponent = getIcon(icon) || CubeIcon;
                        return <IconComponent className="h-6 w-6 text-blue-600" />;
                      })()}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Icon shown in menus and module list
                  </p>
                </div>
              </div>

              {/* Configuration */}
              <div className="space-y-4 mb-6">
                <h3 className="font-medium text-gray-900">Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Statuses (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={statuses}
                      onChange={(e) => setStatuses(e.target.value)}
                      placeholder="active, inactive, pending"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Status
                    </label>
                    <input
                      type="text"
                      value={defaultStatus}
                      onChange={(e) => setDefaultStatus(e.target.value)}
                      placeholder="active"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Features (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={features}
                      onChange={(e) => setFeatures(e.target.value)}
                      placeholder="images, documents, history, links"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: images, documents, history, links, companies
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Menu Location
                    </label>
                    <select
                      value={menuId || ''}
                      onChange={(e) => setMenuId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No menu (standalone)</option>
                      {getMenuOptions().map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select which menu to show this module under
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Module (for sub-modules)
                    </label>
                    <select
                      value={parentModuleId || ''}
                      onChange={(e) => setParentModuleId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">None (top-level module)</option>
                      {modules
                        .filter((m) => m.name !== name && !m.parent_module_id) // Only show top-level modules, exclude self
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Make this a sub-module that appears as a grid on the parent's records
                    </p>
                  </div>
                  <div></div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableEmail}
                        onChange={(e) => setEnableEmail(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable Email</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Show email button in record list to send record details via email
                    </p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableLabelPrint}
                        onChange={(e) => setEnableLabelPrint(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable Label Print</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Show barcode/label print button to add records to print queue
                    </p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableEmailInbox}
                        onChange={(e) => setEnableEmailInbox(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable Email Inbox</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Receive emails with [ModuleName] tag in subject to create records automatically
                    </p>
                  </div>
                  {enableEmailInbox && (
                    <div className="ml-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoProcessEmails}
                          onChange={(e) => setAutoProcessEmails(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Auto-process emails</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Automatically create records from incoming emails (requires global email check interval)
                      </p>
                    </div>
                  )}
                  <div className="pt-3 mt-3 border-t border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useInApp}
                        onChange={(e) => setUseInApp(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable in Mobile App</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Show this module in the BaristaCMS mobile app menu for CRUD operations
                    </p>
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Custom Fields</h3>
                  <button
                    type="button"
                    onClick={addField}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Field
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No custom fields defined</p>
                    <button
                      type="button"
                      onClick={addField}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add your first field
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg items-start"
                      >
                        {/* Name: 2, Display: 2, Type: 2, Options: 3, Weight: 1, Req: 1, Del: 1 = 12 */}
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Name</label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(index, { name: e.target.value })}
                            placeholder="field_name"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={field.displayName}
                            onChange={(e) => updateField(index, { displayName: e.target.value })}
                            placeholder="Field Name"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Type</label>
                          <select
                            value={field.fieldType}
                            onChange={(e) => updateField(index, { fieldType: e.target.value as FieldType })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            {fieldTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          {field.fieldType === 'relation' ? (
                            <>
                              <label className="block text-xs text-gray-500 mb-1">
                                Related Module
                              </label>
                              <select
                                value={field.relationModule}
                                onChange={(e) => updateField(index, { relationModule: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">Select module...</option>
                                {modules
                                  .filter((m) => m.name !== name) // Don't allow self-reference
                                  .map((m) => (
                                    <option key={m.name} value={m.name}>
                                      {m.display_name}
                                    </option>
                                  ))}
                              </select>
                            </>
                          ) : field.fieldType === 'date' ? (
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  Warning Mode
                                </label>
                                <select
                                  value={field.warningMode}
                                  onChange={(e) => updateField(index, { warningMode: e.target.value as DateWarningMode })}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="overdue">Deadline (green → yellow → red when overdue)</option>
                                  <option value="predate">Start Date (yellow → red, stays red after)</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Yellow Warning (days)
                                  </label>
                                  <input
                                    type="number"
                                    value={field.warningYellowDays}
                                    onChange={(e) => updateField(index, { warningYellowDays: e.target.value })}
                                    placeholder="30"
                                    min="0"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Red Warning (days)
                                  </label>
                                  <input
                                    type="number"
                                    value={field.warningRedDays}
                                    onChange={(e) => updateField(index, { warningRedDays: e.target.value })}
                                    placeholder="10"
                                    min="0"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <label className="block text-xs text-gray-500 mb-1">
                                Options (for select)
                              </label>
                              <input
                                type="text"
                                value={field.options}
                                onChange={(e) => updateField(index, { options: e.target.value })}
                                placeholder="Option1, Option2"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                disabled={field.fieldType !== 'select'}
                              />
                            </>
                          )}
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs text-gray-500 mb-1">Weight</label>
                          <input
                            type="number"
                            value={field.weight}
                            onChange={(e) => updateField(index, { weight: e.target.value })}
                            placeholder="50"
                            min="1"
                            max="99"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            title="Lower weight = higher priority (1-99)"
                          />
                        </div>
                        <div className="col-span-1 flex items-end gap-2">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.isRequired}
                              onChange={(e) => updateField(index, { isRequired: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Req
                          </label>
                        </div>
                        <div className="col-span-1 flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Remove field"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name || !displayName}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {selectedModule ? 'Save Changes' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
