/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Building } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

export default function Buildings() {
  const { hasRole } = useAuth();
  const [buildings, setBuildings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    floors: '',
    rooms: '',
    capacity: ''
  });

  async function loadBuildings() {
    const allBuildings = await db.buildings.toArray();
    setBuildings(allBuildings);
  }

  useEffect(() => {
    loadBuildings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const buildingData = {
      ...formData,
      floors: parseInt(formData.floors),
      rooms: parseInt(formData.rooms),
      capacity: parseInt(formData.capacity)
    };

    if (editingBuilding) {
      await db.buildings.update(editingBuilding.id, buildingData);
    } else {
      await db.buildings.add(buildingData);
    }

    setShowForm(false);
    setEditingBuilding(null);
    resetForm();
    loadBuildings();
  };

  const handleEdit = (building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      floors: String(building.floors),
      rooms: String(building.rooms),
      capacity: String(building.capacity)
    });
    setShowForm(true);
  };

  const handleDelete = async (building) => {
    if (window.confirm('Are you sure you want to delete this building?')) {
      await db.buildings.delete(building.id);
      loadBuildings();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      floors: '',
      rooms: '',
      capacity: ''
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBuilding(null);
    resetForm();
  };

  const filteredBuildings = buildings.filter(building =>
    building.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasRole(['admin'])) {
    return (
      <Layout>
        <div className="card p-6">
          <p className="text-slate-500">You don't have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Buildings & Rooms</h2>
            <p className="text-slate-500">Manage school buildings and classrooms</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingBuilding(null);
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Building
          </button>
        </div>

        {/* Inline Form - Shows when showForm is true */}
        {showForm && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {editingBuilding ? 'Edit Building' : 'Add New Building'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Building Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Building Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Enter building name"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Floors */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Floors</label>
                  <input
                    type="number"
                    value={formData.floors}
                    onChange={(e) => setFormData({ ...formData, floors: e.target.value })}
                    className="input"
                    placeholder="Number of floors"
                    required
                  />
                </div>

                {/* Rooms */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Rooms</label>
                  <input
                    type="number"
                    value={formData.rooms}
                    onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                    className="input"
                    placeholder="Number of rooms"
                    required
                  />
                </div>

                {/* Capacity */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="input"
                    placeholder="Total capacity"
                    required
                  />
                </div>
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
                  {editingBuilding ? 'Update Building' : 'Add Building'}
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
              placeholder="Search buildings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Buildings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBuildings.length === 0 ? (
            <div className="col-span-full card p-8 text-center">
              <p className="text-slate-500">No buildings found</p>
            </div>
          ) : (
            filteredBuildings.map((building) => (
              <div key={building.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{building.name}</h3>
                      <p className="text-sm text-slate-500">{building.floors} Floors</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(building)}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Edit className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(building)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="text-sm text-slate-500">Rooms</p>
                    <p className="text-lg font-semibold">{building.rooms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Capacity</p>
                    <p className="text-lg font-semibold">{building.capacity}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
