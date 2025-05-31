# 🏗️ ConstructTrack

> **Fiber Optic Installation Management Platform**

A comprehensive project management platform designed specifically for fiber optic installation
companies, featuring real-time mapping, mobile field worker tools, and customer documentation
management.

## 🚀 Features

- **🗺️ Interactive Mapping**: MapBox integration for fiber route visualization
- **📱 Mobile-First Design**: React Native app optimized for field workers
- **📋 Digital Forms**: Customer agreements and site surveys
- **📸 Photo Documentation**: GPS-tagged progress photos
- **💬 WhatsApp Integration**: Team communication and media export
- **📊 Real-time Analytics**: Project progress and performance tracking
- **🔐 Secure Authentication**: Role-based access control with Supabase

## 🏗️ Architecture

This is a monorepo containing:

- **`apps/web`**: Next.js web application (TypeScript, Tailwind CSS)
- **`apps/mobile`**: React Native mobile app (Expo, TypeScript)
- **`packages/shared`**: Shared utilities and types
- **`packages/ui`**: Shared UI components
- **`packages/supabase`**: Database client and types

## 🛠️ Tech Stack

### Frontend

- **Next.js 15.3.3** with TypeScript
- **React Native 0.79.2** with Expo SDK 53
- **Tailwind CSS** for styling
- **MapBox GL JS** for mapping

### Backend

- **Supabase** (PostgreSQL + Auth + Real-time)
- **PostGIS** for geospatial data
- **Row Level Security** for data isolation

### Development

- **TypeScript** for type safety
- **ESLint** for code quality
- **Notion** for project management sync
- **Ngrok** for webhook tunneling

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (for mobile development)
- Supabase account

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd TiefbauApp

# Install dependencies
npm install

# Install workspace dependencies
npm run packages:build
```

### Development

```bash
# Start web development server
npm run web:dev

# Start mobile development server
npm run mobile:dev

# Start both web and mobile
npm run dev
```

### Environment Setup

Create `.env.local` files in both `apps/web` and `apps/mobile`:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

## 📋 Project Management

This project uses an agile methodology with Notion integration:

- **Epic-Story-Task** hierarchy
- **Real-time sync** between Notion and local markdown
- **Progress tracking** with story points
- **Team assignments** and role-based planning

View the current project plan:
[`docs/constructtrack_agile_project_plan.md`](docs/constructtrack_agile_project_plan.md)

## 🌿 Branching Strategy

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: Feature development branches
- **`hotfix/*`**: Critical bug fixes
- **`release/*`**: Release preparation branches

## 📱 Mobile Development

The mobile app is built with React Native and Expo:

```bash
# Start Expo development server
cd apps/mobile
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## 🗺️ Mapping Features

- **Fiber route visualization** with MapBox
- **GPS coordinate management**
- **Offline map caching**
- **Custom markers and styling**
- **Distance and area measurements**

## 🔐 Authentication & Security

- **Supabase Auth** with email/password
- **Role-based access control** (Admin, Manager, Field Worker)
- **Row Level Security** for data isolation
- **Organization-based permissions**

## 📊 Monitoring & Analytics

- **Real-time project progress**
- **Performance metrics**
- **Error tracking and reporting**
- **Custom dashboards**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support and questions:

- Create an issue in this repository
- Check the [documentation](docs/)
- Review the [project plan](docs/constructtrack_agile_project_plan.md)

---

**Built with ❤️ for the fiber optic installation industry**
