/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, FileText, Download, Video, Image } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

const FileIcon = ({ type }) => {
  if (type === 'Video') return <Video className="w-5 h-5 text-purple-500" />;
  if (type === 'Image') return <Image className="w-5 h-5 text-green-500" />;
  return <FileText className="w-5 h-5 text-blue-500" />;
};

export default function Resources() {
  const { user, hasRole } = useAuth();
  const [resources, setResources] = useState([]);
  const [courses, setCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    courseId: '',
    fileUrl: ''
  });

  async function loadData() {
    const allResources = await db.resources.toArray();
    const allCourses = await db.courses.toArray();
    
    let filteredResources = allResources;
    if (user?.role === 'teacher') {
      filteredResources = allResources.filter(r => r.uploadedBy === user.id);
    }

    const enrichedResources = await Promise.all(
      filteredResources.map(async (resource) => {
        const course = allCourses.find(c => c.id === resource.courseId);
        const uploadedByUser = await db.users.get(resource.uploadedBy);
        return {
          ...resource,
          courseName: course?.name || 'General',
          uploadedByName: uploadedByUser ? `${uploadedByUser.firstName} ${uploadedByUser.lastName}` : 'Unknown'
        };
      })
    );

    setResources(enrichedResources);
    setCourses(allCourses);
  }

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const resourceData = {
      ...formData,
      courseId: formData.courseId ? parseInt(formData.courseId) : null,
      uploadedBy: user?.id,
      uploadedAt: new Date().toISOString()
    };

    if (editingResource) {
      await db.resources.update(editingResource.id, resourceData);
    } else {
      await db.resources.add(resourceData);
    }

    setShowForm(false);
    setEditingResource(null);
    resetForm();
    loadData();
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      type: resource.type,
      courseId: String(resource.courseId),
      fileUrl: resource.fileUrl
    });
    setShowForm(true);
  };

  const handleDelete = async (resource) => {
    if (window.confirm('Are you sure you want to delete this resource?')) {
      await db.resources.delete(resource.id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      type: '',
      courseId: '',
      fileUrl: ''
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingResource(null);
    resetForm();
  };

  const filteredResources = resources.filter(resource =>
    resource.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.courseName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasRole(['admin', 'teacher']);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Learning Resources</h2>
            <p className="text-slate-500">Manage educational materials and resources</p>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                resetForm();
                setEditingResource(null);
                setShowForm(true);
              }}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </button>
          )}
        </div>

        {/* Inline Form - Shows when showForm is true */}
        {showForm && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {editingResource ? 'Edit Resource' : 'Add New Resource'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Enter resource title"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="PDF">PDF</option>
                    <option value="Document">Document</option>
                    <option value="Video">Video</option>
                    <option value="Image">Image</option>
                  </select>
                </div>

                {/* Course */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Course</label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="input"
                  >
                    <option value="">General</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">File URL</label>
                <input
                  type="text"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  className="input"
                  placeholder="Enter file URL"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all duration-200"
                >
                  {editingResource ? 'Update Resource' : 'Add Resource'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="card p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.length === 0 ? (
            <div className="col-span-full card p-8 text-center">
              <p className="text-slate-500">No resources found</p>
            </div>
          ) : (
            filteredResources.map((resource) => (
              <div key={resource.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <FileIcon type={resource.type} />
                    </div>
                    <div>
                      <h3 className="font-semibold line-clamp-1">{resource.title}</h3>
                      <p className="text-sm text-slate-500">{resource.courseName}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(resource)}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(resource)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="badge badge-primary">{resource.type}</span>
                  <button 
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                    onClick={() => alert('Download functionality would be implemented here')}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Uploaded by {resource.uploadedByName} • {new Date(resource.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
