import Landing from './components/Landing'
import Admin from './components/Admin'

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <Landing />
}
