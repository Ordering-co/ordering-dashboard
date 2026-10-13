import React from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { Container, Card, List, SectionTitle } from './styles'

const SkeletonItem = () => {
  return (
    <section>
      <SectionTitle>
        <Skeleton duration={1} height={30} width={300} />
      </SectionTitle>
      <SectionTitle>
        <Skeleton duration={1} height={20} width={100} />
      </SectionTitle>
      <List>
        {Array(4)
          .fill()
          .map((_, index) => (
            <Card key={index}>
              <Skeleton height={180} />
            </Card>
          ))}
      </List>
    </section>
  )
}

export const SkeletonCard = () => {
  return (
    <Container>
      <SkeletonItem />
      <SkeletonItem />
    </Container>
  )
}
